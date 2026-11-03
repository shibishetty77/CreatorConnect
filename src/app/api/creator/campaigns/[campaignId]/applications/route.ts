import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { consumeActionRateLimit } from "@/lib/auth/rate-limit";
import { recordCampaignApplication } from "@/lib/platform-events";
import {
  applyCreatorToCampaign,
  CampaignApplicationError,
} from "@/lib/repositories/campaign-discovery";
import { campaignIdParamSchema } from "@/lib/validations/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CampaignApplicationRouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function POST(
  request: NextRequest,
  context: CampaignApplicationRouteContext,
) {
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

  const rateLimit = consumeActionRateLimit(
    `apply-campaign:${actor.user.creatorProfile.creatorId}`,
    20,
    10 * 60 * 1000,
  );

  if (rateLimit.limited) {
    const response = apiError(
      429,
      "RATE_LIMITED",
      "Too many application attempts. Please wait and try again.",
    );
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }

  const { campaignId: rawCampaignId } = await context.params;
  const parsedCampaignId = campaignIdParamSchema.safeParse(rawCampaignId);

  if (!parsedCampaignId.success) {
    return apiError(
      400,
      "INVALID_CAMPAIGN_ID",
      "The campaign ID must be a positive integer.",
    );
  }

  try {
    const application = await applyCreatorToCampaign(
      actor.user.creatorProfile.creatorId,
      parsedCampaignId.data,
    );
    await recordCampaignApplication({
      applicationId: application.applicationId,
      campaignId: parsedCampaignId.data,
      creatorUserId: actor.user.userId,
      creatorRole: actor.user.role,
    });

    return apiSuccess({ application }, 201);
  } catch (error) {
    if (error instanceof CampaignApplicationError) {
      if (error.code === "CAMPAIGN_NOT_FOUND") {
        return apiError(404, error.code, error.message);
      }

      if (error.code === "INELIGIBLE") {
        return apiError(
          422,
          error.code,
          error.message,
          { eligibility: error.reasons.join(" ") },
        );
      }

      return apiError(409, error.code, error.message);
    }

    console.error(
      "Creator campaign application failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "APPLICATION_CREATE_FAILED",
      "We could not submit your application. Please try again.",
    );
  }
}
