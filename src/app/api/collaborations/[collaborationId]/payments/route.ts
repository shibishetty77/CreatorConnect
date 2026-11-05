import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { financeApiError } from "@/lib/api/finance";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  createPayment,
  listPaymentsForParty,
} from "@/lib/repositories/finance";
import { recordPaymentCreated } from "@/lib/platform-events";
import {
  financeIdParamSchema,
  paymentCreateSchema,
} from "@/lib/validations/finance";
import { zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ collaborationId: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const actor = await requireApiRole("Creator", "Brand", "Admin");
  if (actor.error) return actor.error;

  let role: "Creator" | "Brand" | "Admin";
  let profileId: number | null;
  if (actor.user.role === "Creator") {
    if (!actor.user.creatorProfile) return missingProfileError("Creator");
    role = "Creator";
    profileId = actor.user.creatorProfile.creatorId;
  } else if (actor.user.role === "Brand") {
    if (!actor.user.brandProfile) return missingProfileError("Brand");
    role = "Brand";
    profileId = actor.user.brandProfile.brandId;
  } else {
    role = "Admin";
    profileId = null;
  }

  const { collaborationId: rawId } = await context.params;
  const parsedId = financeIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return apiError(400, "INVALID_COLLABORATION_ID", "The collaboration ID is invalid.");
  }

  try {
    const payments = await listPaymentsForParty({
      collaborationId: parsedId.data,
      role,
      profileId,
    });
    return apiSuccess({ payments });
  } catch (error) {
    return financeApiError(error, "Collaboration payments could not be loaded");
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request);
  if (guard) return guard;

  const actor = await requireApiRole("Brand");
  if (actor.error) return actor.error;
  if (!actor.user.brandProfile) return missingProfileError("Brand");

  const { collaborationId: rawId } = await context.params;
  const parsedId = financeIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return apiError(400, "INVALID_COLLABORATION_ID", "The collaboration ID is invalid.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
  const parsedBody = paymentCreateSchema.safeParse(body);
  if (!parsedBody.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the payment details.",
      zodFieldErrors(parsedBody.error),
    );
  }

  try {
    const result = await createPayment({
      brandId: actor.user.brandProfile.brandId,
      collaborationId: parsedId.data,
      payment: parsedBody.data,
    });
    await recordPaymentCreated({
      paymentId: result.paymentId,
      brandUserId: actor.user.userId,
    });
    return apiSuccess(result, 201);
  } catch (error) {
    return financeApiError(error, "Brand payment creation failed");
  }
}
