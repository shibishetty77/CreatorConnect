import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { getBrandProfile, updateBrandProfile } from "@/lib/repositories/brand-profiles";
import { zodFieldErrors } from "@/lib/validations/auth";
import { brandProfileSchema } from "@/lib/validations/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Brand");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.brandProfile) {
    return missingProfileError("Brand");
  }

  const profile = await getBrandProfile(actor.user.brandProfile.brandId);

  if (!profile) {
    return missingProfileError("Brand");
  }

  return apiSuccess({ profile });
}

export async function PATCH(request: NextRequest) {
  const guard = mutationGuard(request);

  if (guard) {
    return guard;
  }

  const actor = await requireApiRole("Brand");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.brandProfile) {
    return missingProfileError("Brand");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const parsed = brandProfileSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    const profile = await updateBrandProfile(
      actor.user.brandProfile.brandId,
      parsed.data,
    );

    if (!profile) {
      return missingProfileError("Brand");
    }

    return apiSuccess({ profile });
  } catch (error) {
    console.error(
      "Brand profile update failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "PROFILE_UPDATE_FAILED",
      "We could not update your profile. Please try again.",
    );
  }
}
