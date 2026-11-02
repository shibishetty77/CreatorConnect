import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { deliveryApiError } from "@/lib/api/delivery";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  deleteDeliverable,
  updateDeliverable,
} from "@/lib/repositories/delivery";
import {
  deliveryIdParamSchema,
  deliverableUpdateSchema,
} from "@/lib/validations/delivery";
import { zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ deliverableId: string }> };

async function getDeliverableId(context: RouteContext) {
  const { deliverableId: rawId } = await context.params;
  return deliveryIdParamSchema.safeParse(rawId);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request);
  if (guard) return guard;

  const actor = await requireApiRole("Brand");
  if (actor.error) return actor.error;
  if (!actor.user.brandProfile) return missingProfileError("Brand");

  const parsedId = await getDeliverableId(context);
  if (!parsedId.success) {
    return apiError(400, "INVALID_DELIVERABLE_ID", "The deliverable ID is invalid.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
  const parsedBody = deliverableUpdateSchema.safeParse(body);
  if (!parsedBody.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsedBody.error),
    );
  }

  try {
    await updateDeliverable(
      actor.user.brandProfile.brandId,
      parsedId.data,
      parsedBody.data,
    );
    return apiSuccess({ deliverableId: parsedId.data });
  } catch (error) {
    return deliveryApiError(error, "Brand deliverable update failed");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request, { requireJson: false });
  if (guard) return guard;

  const actor = await requireApiRole("Brand");
  if (actor.error) return actor.error;
  if (!actor.user.brandProfile) return missingProfileError("Brand");

  const parsedId = await getDeliverableId(context);
  if (!parsedId.success) {
    return apiError(400, "INVALID_DELIVERABLE_ID", "The deliverable ID is invalid.");
  }

  try {
    await deleteDeliverable(
      actor.user.brandProfile.brandId,
      parsedId.data,
    );
    return apiSuccess({ deleted: true });
  } catch (error) {
    return deliveryApiError(error, "Brand deliverable deletion failed");
  }
}
