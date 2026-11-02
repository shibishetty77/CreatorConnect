import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { getCreatorProfile, updateCreatorProfile } from "@/lib/repositories/creator-profiles";
import { zodFieldErrors } from "@/lib/validations/auth";
import { creatorProfileSchema } from "@/lib/validations/profiles";

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

  const profile = await getCreatorProfile(actor.user.creatorProfile.creatorId);

  if (!profile) {
    return missingProfileError("Creator");
  }

  return apiSuccess({ profile });
}

export async function PATCH(request: NextRequest) {
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

  const parsed = creatorProfileSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    const profile = await updateCreatorProfile(
      actor.user.creatorProfile.creatorId,
      parsed.data,
    );

    if (!profile) {
      return missingProfileError("Creator");
    }

    return apiSuccess({ profile });
  } catch (error) {
    console.error(
      "Creator profile update failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "PROFILE_UPDATE_FAILED",
      "We could not update your profile. Please try again.",
    );
  }
}
