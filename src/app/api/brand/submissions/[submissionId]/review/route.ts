import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { deliveryApiError } from "@/lib/api/delivery";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { reviewSubmission } from "@/lib/repositories/delivery";
import {
  deliveryIdParamSchema,
  submissionReviewSchema,
} from "@/lib/validations/delivery";
import { zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ submissionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request);
  if (guard) return guard;

  const actor = await requireApiRole("Brand");
  if (actor.error) return actor.error;
  if (!actor.user.brandProfile) return missingProfileError("Brand");

  const { submissionId: rawId } = await context.params;
  const parsedId = deliveryIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return apiError(400, "INVALID_SUBMISSION_ID", "The submission ID is invalid.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
  const parsedBody = submissionReviewSchema.safeParse(body);
  if (!parsedBody.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Choose approval or rejection for this submission.",
      zodFieldErrors(parsedBody.error),
    );
  }

  try {
    await reviewSubmission(
      actor.user.brandProfile.brandId,
      parsedId.data,
      parsedBody.data.approvalStatus,
    );
    return apiSuccess({
      submissionId: parsedId.data,
      approvalStatus: parsedBody.data.approvalStatus,
    });
  } catch (error) {
    return deliveryApiError(error, "Brand submission review failed");
  }
}
