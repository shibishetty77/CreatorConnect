import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { mutationGuard } from "@/lib/auth/csrf";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import {
  clearLoginFailures,
  getRateLimitKey,
  getRateLimitStatus,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import { safeRedirectForRole } from "@/lib/auth/redirects";
import { createSessionCookie } from "@/lib/auth/session";
import { findUserByLogin } from "@/lib/auth/users";
import { loginSchema, zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID_CREDENTIALS =
  "Email/username or password is incorrect. Please try again.";

export async function POST(request: NextRequest) {
  const guard = mutationGuard(request);

  if (guard) {
    return guard;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  const rateLimitKey = getRateLimitKey(
    request.headers,
    parsed.data.identifier,
  );
  const limit = getRateLimitStatus(rateLimitKey);

  if (limit.limited) {
    const response = apiError(
      429,
      "RATE_LIMITED",
      "Too many sign-in attempts. Please wait and try again.",
    );
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return response;
  }

  try {
    const user = await findUserByLogin(parsed.data.identifier);
    const passwordMatches = await verifyPassword(
      parsed.data.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      recordLoginFailure(rateLimitKey);
      return apiError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS);
    }

    clearLoginFailures(rateLimitKey);

    await createSessionCookie({
      userId: user.userId,
      username: user.username,
      role: user.role,
    });

    return apiSuccess({
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      redirectTo: safeRedirectForRole(parsed.data.next, user.role),
    });
  } catch (error) {
    console.error(
      "Login failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "LOGIN_FAILED",
      "We could not complete sign-in. Please try again.",
    );
  }
}
