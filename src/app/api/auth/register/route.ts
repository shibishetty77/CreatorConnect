import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { mutationGuard } from "@/lib/auth/csrf";
import { dashboardForRole } from "@/lib/auth/constants";
import { DuplicateAccountError } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";
import { createUserWithProfile } from "@/lib/auth/users";
import {
  registerSchema,
  zodFieldErrors,
} from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await createUserWithProfile({
      username: parsed.data.username,
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
    });

    await createSessionCookie({
      userId: user.userId,
      username: user.username,
      role: user.role,
    });

    return apiSuccess(
      {
        user,
        redirectTo: dashboardForRole(user.role),
      },
      201,
    );
  } catch (error) {
    if (error instanceof DuplicateAccountError) {
      return apiError(
        409,
        "ACCOUNT_EXISTS",
        error.message,
        { [error.field]: error.message },
      );
    }

    console.error(
      "Registration failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "REGISTRATION_FAILED",
      "We could not create your account. Please try again.",
    );
  }
}
