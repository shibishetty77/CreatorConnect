import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { deliveryApiError } from "@/lib/api/delivery";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { submitDeliverable } from "@/lib/repositories/delivery";
import {
  contentSubmissionSchema,
  deliveryIdParamSchema,
} from "@/lib/validations/delivery";
import { zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ deliverableId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request);
  if (guard) return guard;

  const actor = await requireApiRole("Creator");
  if (actor.error) return actor.error;
  if (!actor.user.creatorProfile) return missingProfileError("Creator");

  const { deliverableId: rawId } = await context.params;
  const parsedId = deliveryIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return apiError(400, "INVALID_DELIVERABLE_ID", "The deliverable ID is invalid.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
  const parsedBody = contentSubmissionSchema.safeParse(body);
  if (!parsedBody.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsedBody.error),
    );
  }

  try {
    const result = await submitDeliverable(
      actor.user.creatorProfile.creatorId,
      parsedId.data,
      parsedBody.data.contentUrl,
    );
    return apiSuccess(result, 201);
  } catch (error) {
    return deliveryApiError(error, "Creator content submission failed");
  }
}
