import { apiSuccess } from "@/lib/api/response";
import { financeApiError } from "@/lib/api/finance";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { listPaymentsForRole } from "@/lib/repositories/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Creator");
  if (actor.error) return actor.error;
  if (!actor.user.creatorProfile) return missingProfileError("Creator");

  try {
    const payments = await listPaymentsForRole(
      "Creator",
      actor.user.creatorProfile.creatorId,
    );
    return apiSuccess({ payments });
  } catch (error) {
    return financeApiError(error, "Creator payment history could not be loaded");
  }
}
