import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { consumeActionRateLimit } from "@/lib/auth/rate-limit";
import {
  getPasswordHashForUser,
  updatePasswordHash,
} from "@/lib/auth/users";
import { zodFieldErrors } from "@/lib/validations/auth";
import { passwordChangeSchema } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = mutationGuard(request);

  if (guard) {
    return guard;
  }

  const actor = await requireApiRole("Creator");

  if (actor.error) {
    return actor.error;
  }

  const rateLimit = consumeActionRateLimit(
    `change-password:${actor.user.userId}`,
    5,
    15 * 60 * 1000,
  );

  if (rateLimit.limited) {
    const response = apiError(
      429,
      "RATE_LIMITED",
      "Too many password change attempts. Please wait and try again.",
    );
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const parsed = passwordChangeSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    const currentHash = await getPasswordHashForUser(actor.user.userId);

    if (!currentHash) {
      return apiError(
        404,
        "ACCOUNT_NOT_FOUND",
        "Your account could not be found.",
      );
    }

    const matches = await verifyPassword(
      parsed.data.currentPassword,
      currentHash,
    );

    if (!matches) {
      return apiError(
        401,
        "INVALID_CURRENT_PASSWORD",
        "The current password is incorrect.",
        { currentPassword: "The current password is incorrect." },
      );
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await updatePasswordHash(actor.user.userId, newHash);

    return apiSuccess({ updated: true });
  } catch (error) {
    console.error(
      "Creator password change failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "PASSWORD_CHANGE_FAILED",
      "We could not update your password. Please try again.",
    );
  }
}
