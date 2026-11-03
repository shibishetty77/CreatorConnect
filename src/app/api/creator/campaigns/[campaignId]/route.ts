import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { getCreatorCampaignById } from "@/lib/repositories/campaign-discovery";
import { campaignIdParamSchema } from "@/lib/validations/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const actor = await requireApiRole("Creator");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.creatorProfile) {
    return missingProfileError("Creator");
  }

  const { campaignId: rawId } = await context.params;
  const parsedId = campaignIdParamSchema.safeParse(rawId);

  if (!parsedId.success) {
    return apiError(
      400,
      "INVALID_CAMPAIGN_ID",
      "The campaign ID must be a positive integer.",
    );
  }

  try {
    const campaign = await getCreatorCampaignById(
      actor.user.creatorProfile.creatorId,
      parsedId.data,
    );

    if (!campaign) {
      return apiError(404, "CAMPAIGN_NOT_FOUND", "This campaign could not be found.");
    }

    return apiSuccess({ campaign });
  } catch (error) {
    console.error(
      "Creator campaign detail failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "CAMPAIGN_LOAD_FAILED",
      "We could not load this campaign. Please try again.",
    );
  }
}
