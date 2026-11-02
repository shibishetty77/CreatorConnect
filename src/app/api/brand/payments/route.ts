import { apiSuccess } from "@/lib/api/response";
import { financeApiError } from "@/lib/api/finance";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { listPaymentsForRole } from "@/lib/repositories/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Brand");
  if (actor.error) return actor.error;
  if (!actor.user.brandProfile) return missingProfileError("Brand");

  try {
    const payments = await listPaymentsForRole(
      "Brand",
      actor.user.brandProfile.brandId,
    );
    return apiSuccess({ payments });
  } catch (error) {
    return financeApiError(error, "Brand payments could not be loaded");
  }
}
