import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  BrandCampaignError,
  updateBrandCampaign,
} from "@/lib/repositories/brand-campaigns";
import { campaignIdParamSchema, brandCampaignUpdateSchema } from "@/lib/validations/campaigns";
import { zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request);
  if (guard) return guard;

  const actor = await requireApiRole("Brand");
  if (actor.error) return actor.error;
  if (!actor.user.brandProfile) return missingProfileError("Brand");

  const { campaignId: rawCampaignId } = await context.params;
  const parsedId = campaignIdParamSchema.safeParse(rawCampaignId);
  if (!parsedId.success) {
    return apiError(400, "INVALID_CAMPAIGN_ID", "The campaign ID is invalid.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const parsed = brandCampaignUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    await updateBrandCampaign(
      actor.user.brandProfile.brandId,
      parsedId.data,
      parsed.data,
    );
    return apiSuccess({ campaignId: parsedId.data });
  } catch (error) {
    if (error instanceof BrandCampaignError) {
      return apiError(
        error.code === "CAMPAIGN_NOT_FOUND" ? 404 : 400,
        error.code,
        error.message,
      );
    }
    console.error(
      "Brand campaign update failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return apiError(
      500,
      "CAMPAIGN_UPDATE_FAILED",
      "We could not update the campaign. Please try again.",
    );
  }
}
