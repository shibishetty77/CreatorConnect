import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { listBrandCollaborations } from "@/lib/repositories/collaborations";

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

  try {
    const collaborations = await listBrandCollaborations(
      actor.user.brandProfile.brandId,
    );

    return apiSuccess({ collaborations });
  } catch (error) {
    console.error(
      "Brand collaborations could not be loaded:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "COLLABORATIONS_LOAD_FAILED",
      "We could not load collaborations. Please try again.",
    );
  }
}
