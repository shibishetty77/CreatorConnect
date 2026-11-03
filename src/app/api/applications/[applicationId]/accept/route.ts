import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { recordApplicationAccepted } from "@/lib/platform-events";
import {
  acceptBrandApplication,
  ApplicationDecisionError,
} from "@/lib/repositories/brand-applications";
import { acceptApplicationSchema, applicationIdParamSchema } from "@/lib/validations/applications";
import { zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApplicationRouteContext = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(
  request: NextRequest,
  context: ApplicationRouteContext,
) {
  const guard = mutationGuard(request);

  if (guard) {
    return guard;
  }

  const actor = await requireApiRole("Brand");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.brandProfile) {
    return missingProfileError("Brand");
  }

  const { applicationId: rawApplicationId } = await context.params;
  const parsedId = applicationIdParamSchema.safeParse(rawApplicationId);

  if (!parsedId.success) {
    return apiError(
      400,
      "INVALID_APPLICATION_ID",
      "The application ID must be a positive integer.",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const parsedBody = acceptApplicationSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsedBody.error),
    );
  }

  try {
    const result = await acceptBrandApplication(
      actor.user.brandProfile.brandId,
      parsedId.data,
      parsedBody.data,
    );
    await recordApplicationAccepted({
      applicationId: result.applicationId,
      collaborationId: result.collaborationId,
      brandUserId: actor.user.userId,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    if (error instanceof ApplicationDecisionError) {
      const status = error.code === "APPLICATION_NOT_FOUND" ? 404 : 409;
      return apiError(status, error.code, error.message);
    }

    console.error(
      "Brand application acceptance failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "APPLICATION_ACCEPT_FAILED",
      "We could not accept this application. Please try again.",
    );
  }
}
