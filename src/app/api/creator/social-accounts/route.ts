import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  createSocialAccount,
  listSocialAccounts,
} from "@/lib/repositories/creator-profiles";
import { zodFieldErrors } from "@/lib/validations/auth";
import { socialAccountSchema } from "@/lib/validations/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Creator");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.creatorProfile) {
    return missingProfileError("Creator");
  }

  const accounts = await listSocialAccounts(
    actor.user.creatorProfile.creatorId,
  );

  return apiSuccess({ accounts });
}

export async function POST(request: NextRequest) {
  const guard = mutationGuard(request);

  if (guard) {
    return guard;
  }

  const actor = await requireApiRole("Creator");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.creatorProfile) {
    return missingProfileError("Creator");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const parsed = socialAccountSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    const account = await createSocialAccount(
      actor.user.creatorProfile.creatorId,
      parsed.data,
    );

    if (!account) {
      return apiError(
        500,
        "SOCIAL_ACCOUNT_CREATE_FAILED",
        "We could not add this social account.",
      );
    }

    return apiSuccess({ account }, 201);
  } catch (error) {
    console.error(
      "Social account creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "SOCIAL_ACCOUNT_CREATE_FAILED",
      "We could not add this social account. Please try again.",
    );
  }
}
