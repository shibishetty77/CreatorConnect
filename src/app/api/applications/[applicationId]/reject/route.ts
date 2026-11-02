import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  ApplicationDecisionError,
  rejectBrandApplication,
} from "@/lib/repositories/brand-applications";
import { applicationIdParamSchema } from "@/lib/validations/applications";

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

  try {
    const result = await rejectBrandApplication(
      actor.user.brandProfile.brandId,
      parsedId.data,
    );

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof ApplicationDecisionError) {
      const status = error.code === "APPLICATION_NOT_FOUND" ? 404 : 409;
      return apiError(status, error.code, error.message);
    }

    console.error(
      "Brand application rejection failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "APPLICATION_REJECT_FAILED",
      "We could not reject this application. Please try again.",
    );
  }
}
