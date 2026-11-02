import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { listCreatorDeliverables } from "@/lib/repositories/delivery";
import { deliveryApiError } from "@/lib/api/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Creator");

  if (actor.error) {
    return actor.error;
  }
  if (!actor.user.creatorProfile) {
    return missingProfileError("Creator");
  }

  try {
    const deliverables = await listCreatorDeliverables(
      actor.user.creatorProfile.creatorId,
    );
    return apiSuccess({ deliverables });
  } catch (error) {
    return deliveryApiError(error, "Creator delivery workspace could not be loaded");
  }
}
