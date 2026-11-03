import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { financeApiError } from "@/lib/api/finance";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { recordPaymentPaid } from "@/lib/platform-events";
import { updatePayment } from "@/lib/repositories/finance";
import {
  financeIdParamSchema,
  paymentUpdateSchema,
} from "@/lib/validations/finance";
import { zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ paymentId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request);
  if (guard) return guard;

  const actor = await requireApiRole("Brand", "Admin");
  if (actor.error) return actor.error;
  if (actor.user.role === "Creator") {
    return apiError(403, "FORBIDDEN", "Creators cannot update payments.");
  }
  if (actor.user.role === "Brand" && !actor.user.brandProfile) {
    return missingProfileError("Brand");
  }

  const { paymentId: rawId } = await context.params;
  const parsedId = financeIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return apiError(400, "INVALID_PAYMENT_ID", "The payment ID is invalid.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
  const parsedBody = paymentUpdateSchema.safeParse(body);
  if (!parsedBody.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the payment update.",
      zodFieldErrors(parsedBody.error),
    );
  }

  try {
    const result = await updatePayment({
      paymentId: parsedId.data,
      role: actor.user.role,
      brandId: actor.user.brandProfile?.brandId ?? null,
      updates: parsedBody.data,
    });
    if (result.status === "Paid" && parsedBody.data.status === "Paid") {
      await recordPaymentPaid({
        paymentId: result.paymentId,
        actorId: actor.user.userId,
        actorRole: actor.user.role,
      });
    }
    return apiSuccess(result);
  } catch (error) {
    return financeApiError(error, "Payment update failed");
  }
}
