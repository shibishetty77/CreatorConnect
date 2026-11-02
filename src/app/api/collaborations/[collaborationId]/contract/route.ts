import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { deliveryApiError } from "@/lib/api/delivery";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { getContractForParty } from "@/lib/repositories/delivery";
import { deliveryIdParamSchema } from "@/lib/validations/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ collaborationId: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const actor = await requireApiRole("Creator", "Brand");
  if (actor.error) return actor.error;

  let role: "Creator" | "Brand";
  let profileId: number;
  if (actor.user.role === "Creator") {
    if (!actor.user.creatorProfile) return missingProfileError("Creator");
    role = "Creator";
    profileId = actor.user.creatorProfile.creatorId;
  } else if (actor.user.role === "Brand") {
    if (!actor.user.brandProfile) return missingProfileError("Brand");
    role = "Brand";
    profileId = actor.user.brandProfile.brandId;
  } else {
    return apiError(403, "FORBIDDEN", "You cannot access this contract.");
  }

  const { collaborationId: rawId } = await context.params;
  const parsedId = deliveryIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return apiError(400, "INVALID_COLLABORATION_ID", "The collaboration ID is invalid.");
  }

  try {
    const contract = await getContractForParty({
      collaborationId: parsedId.data,
      role,
      profileId,
    });
    return apiSuccess({ contract });
  } catch (error) {
    return deliveryApiError(error, "Contract could not be loaded");
  }
}
