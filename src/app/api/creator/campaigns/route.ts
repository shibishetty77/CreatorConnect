import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { listCreatorCampaigns } from "@/lib/repositories/campaign-discovery";

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
    const campaigns = await listCreatorCampaigns(
      actor.user.creatorProfile.creatorId,
    );

    return apiSuccess({ campaigns });
  } catch (error) {
    console.error(
      "Creator campaign discovery failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "CAMPAIGNS_LOAD_FAILED",
      "We could not load campaigns. Please try again.",
    );
  }
}
