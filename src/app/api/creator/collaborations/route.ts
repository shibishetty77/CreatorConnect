import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { listCreatorCollaborations } from "@/lib/repositories/collaborations";

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

  try {
    const collaborations = await listCreatorCollaborations(
      actor.user.creatorProfile.creatorId,
    );

    return apiSuccess({ collaborations });
  } catch (error) {
    console.error(
      "Creator collaborations could not be loaded:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "COLLABORATIONS_LOAD_FAILED",
      "We could not load collaborations. Please try again.",
    );
  }
}
