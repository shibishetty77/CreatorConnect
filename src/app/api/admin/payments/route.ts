import { apiSuccess } from "@/lib/api/response";
import { financeApiError } from "@/lib/api/finance";
import { requireApiRole } from "@/lib/auth/api";
import { listPaymentsForRole } from "@/lib/repositories/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Admin");
  if (actor.error) return actor.error;

  try {
    const payments = await listPaymentsForRole("Admin");
    return apiSuccess({ payments });
  } catch (error) {
    return financeApiError(error, "Admin payment list could not be loaded");
  }
}
