import { apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { deliveryApiError } from "@/lib/api/delivery";
import { listBrandDeliverables } from "@/lib/repositories/delivery";
import { listBrandCollaborations } from "@/lib/repositories/collaborations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Brand");

  if (actor.error) {
    return actor.error;
  }
  if (!actor.user.brandProfile) {
    return missingProfileError("Brand");
  }

  try {
    const deliverables = await listBrandDeliverables(
      actor.user.brandProfile.brandId,
    );
    const collaborations = await listBrandCollaborations(
      actor.user.brandProfile.brandId,
    );
    return apiSuccess({ deliverables, collaborations });
  } catch (error) {
    return deliveryApiError(error, "Brand delivery workspace could not be loaded");
  }
}
