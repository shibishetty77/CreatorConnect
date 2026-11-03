import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import {
  getCampaignFilterOptions,
  listCreatorCampaigns,
} from "@/lib/repositories/campaign-discovery";
import { creatorCampaignQuerySchema } from "@/lib/validations/campaigns";
import { zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const actor = await requireApiRole("Creator");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.creatorProfile) {
    return missingProfileError("Creator");
  }

  const rawQuery: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (value !== "") {
      rawQuery[key] = value;
    }
  }

  const parsed = creatorCampaignQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_FILTERS",
      "Please correct the campaign filters.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    const [page, options] = await Promise.all([
      listCreatorCampaigns(
        actor.user.creatorProfile.creatorId,
        parsed.data,
      ),
      getCampaignFilterOptions(),
    ]);

    return apiSuccess({ ...page, filters: options });
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
