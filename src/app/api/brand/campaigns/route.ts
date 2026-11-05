import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  BrandCampaignError,
  createBrandCampaign,
  listBrandCampaigns,
  listCampaignCategoryOptions,
} from "@/lib/repositories/brand-campaigns";
import { zodFieldErrors } from "@/lib/validations/auth";
import { brandCampaignCreateSchema } from "@/lib/validations/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Brand");
  if (actor.error) return actor.error;
  if (!actor.user.brandProfile) return missingProfileError("Brand");

  try {
    const [campaigns, categories] = await Promise.all([
      listBrandCampaigns(actor.user.brandProfile.brandId),
      listCampaignCategoryOptions(),
    ]);
    return apiSuccess({ campaigns, categories });
  } catch (error) {
    console.error(
      "Brand campaigns could not be loaded:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return apiError(
      500,
      "CAMPAIGNS_LOAD_FAILED",
      "We could not load campaigns. Please try again.",
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = mutationGuard(request);
  if (guard) return guard;

  const actor = await requireApiRole("Brand");
  if (actor.error) return actor.error;
  if (!actor.user.brandProfile) return missingProfileError("Brand");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const parsed = brandCampaignCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    const campaignId = await createBrandCampaign(
      actor.user.brandProfile.brandId,
      parsed.data,
    );
    return apiSuccess({ campaignId }, 201);
  } catch (error) {
    if (error instanceof BrandCampaignError) {
      return apiError(400, error.code, error.message);
    }
    console.error(
      "Brand campaign creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return apiError(
      500,
      "CAMPAIGN_CREATE_FAILED",
      "We could not create the campaign. Please try again.",
    );
  }
}
