import { apiError, apiSuccess } from "@/lib/api/response";
import { requireApiRole } from "@/lib/auth/api";
import { getAdminReportOverview } from "@/lib/repositories/admin-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Admin");
  if (actor.error) return actor.error;

  try {
    return apiSuccess(await getAdminReportOverview());
  } catch (error) {
    console.error("Admin report overview could not be loaded:", error);
    return apiError(
      500,
      "REPORT_OVERVIEW_FAILED",
      "The platform report could not be loaded.",
    );
  }
}
