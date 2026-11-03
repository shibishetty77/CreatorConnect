import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { consumeActionRateLimit } from "@/lib/auth/rate-limit";
import {
  ApplicationWithdrawalError,
  getCreatorApplicationById,
  withdrawCreatorApplication,
} from "@/lib/repositories/applications";
import { applicationIdParamSchema } from "@/lib/validations/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ applicationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const actor = await requireApiRole("Creator");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.creatorProfile) {
    return missingProfileError("Creator");
  }

  const { applicationId: rawId } = await context.params;
  const parsedId = applicationIdParamSchema.safeParse(rawId);

  if (!parsedId.success) {
    return apiError(
      400,
      "INVALID_APPLICATION_ID",
      "The application ID must be a positive integer.",
    );
  }

  const application = await getCreatorApplicationById(
    actor.user.creatorProfile.creatorId,
    parsedId.data,
  );

  if (!application) {
    return apiError(
      404,
      "APPLICATION_NOT_FOUND",
      "This application could not be found.",
    );
  }

  return apiSuccess({ application });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request, { requireJson: false });

  if (guard) {
    return guard;
  }

  const actor = await requireApiRole("Creator");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.creatorProfile) {
    return missingProfileError("Creator");
  }

  const rateLimit = consumeActionRateLimit(
    `withdraw-application:${actor.user.creatorProfile.creatorId}`,
    10,
    10 * 60 * 1000,
  );

  if (rateLimit.limited) {
    const response = apiError(
      429,
      "RATE_LIMITED",
      "Too many withdrawal attempts. Please wait and try again.",
    );
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }

  const { applicationId: rawId } = await context.params;
  const parsedId = applicationIdParamSchema.safeParse(rawId);

  if (!parsedId.success) {
    return apiError(
      400,
      "INVALID_APPLICATION_ID",
      "The application ID must be a positive integer.",
    );
  }

  try {
    await withdrawCreatorApplication(
      actor.user.creatorProfile.creatorId,
      parsedId.data,
    );

    return apiSuccess({ withdrawn: true });
  } catch (error) {
    if (error instanceof ApplicationWithdrawalError) {
      const status = error.code === "APPLICATION_NOT_FOUND" ? 404 : 409;
      return apiError(status, error.code, error.message);
    }

    console.error(
      "Creator application withdrawal failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "APPLICATION_WITHDRAW_FAILED",
      "We could not withdraw this application. Please try again.",
    );
  }
}
