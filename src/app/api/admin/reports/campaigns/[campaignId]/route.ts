import { apiError, apiSuccess } from "@/lib/api/response";
import { requireApiRole } from "@/lib/auth/api";
import { getAdminCampaignReport } from "@/lib/repositories/admin-reports";
import { financeIdParamSchema } from "@/lib/validations/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const actor = await requireApiRole("Admin");
  if (actor.error) return actor.error;

  const { campaignId: rawId } = await context.params;
  const parsedId = financeIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return apiError(400, "INVALID_CAMPAIGN_ID", "The campaign ID is invalid.");
  }

  try {
    const report = await getAdminCampaignReport(parsedId.data);
    if (!report) {
      return apiError(404, "CAMPAIGN_NOT_FOUND", "The campaign was not found.");
    }
    return apiSuccess({ report });
  } catch (error) {
    console.error("Admin campaign report could not be loaded:", error);
    return apiError(
      500,
      "CAMPAIGN_REPORT_FAILED",
      "The campaign report could not be loaded.",
    );
  }
}
