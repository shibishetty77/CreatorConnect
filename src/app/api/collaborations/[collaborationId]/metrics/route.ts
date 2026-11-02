import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { financeApiError } from "@/lib/api/finance";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  getMetricsForParty,
  upsertMetrics,
} from "@/lib/repositories/finance";
import {
  financeIdParamSchema,
  metricsUpsertSchema,
} from "@/lib/validations/finance";
import { zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ collaborationId: string }> };

async function getScope() {
  const actor = await requireApiRole("Creator", "Brand", "Admin");
  if (actor.error) return { response: actor.error } as const;

  if (actor.user.role === "Creator") {
    if (!actor.user.creatorProfile) {
      return { response: missingProfileError("Creator") } as const;
    }
    return {
      actor,
      role: "Creator" as const,
      profileId: actor.user.creatorProfile.creatorId,
    };
  }
  if (actor.user.role === "Brand") {
    if (!actor.user.brandProfile) {
      return { response: missingProfileError("Brand") } as const;
    }
    return {
      actor,
      role: "Brand" as const,
      profileId: actor.user.brandProfile.brandId,
    };
  }
  return { actor, role: "Admin" as const, profileId: null };
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const scope = await getScope();
  if ("response" in scope) return scope.response;

  const { collaborationId: rawId } = await context.params;
  const parsedId = financeIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return apiError(400, "INVALID_COLLABORATION_ID", "The collaboration ID is invalid.");
  }

  try {
    const metrics = await getMetricsForParty({
      collaborationId: parsedId.data,
      role: scope.role,
      profileId: scope.profileId,
    });
    return apiSuccess({ metrics });
  } catch (error) {
    return financeApiError(error, "Collaboration metrics could not be loaded");
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request);
  if (guard) return guard;

  const actor = await requireApiRole("Brand", "Admin");
  if (actor.error) return actor.error;
  if (actor.user.role === "Creator") {
    return apiError(403, "FORBIDDEN", "Creators cannot update performance metrics.");
  }
  if (actor.user.role === "Brand" && !actor.user.brandProfile) {
    return missingProfileError("Brand");
  }

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
  const parsedBody = metricsUpsertSchema.safeParse(body);
  if (!parsedBody.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Enter non-negative whole-number metrics within the database range.",
      zodFieldErrors(parsedBody.error),
    );
  }

  try {
    const metrics = await upsertMetrics({
      collaborationId: parsedId.data,
      role: actor.user.role,
      profileId: actor.user.brandProfile?.brandId ?? null,
      metrics: parsedBody.data,
    });
    return apiSuccess({ metrics });
  } catch (error) {
    return financeApiError(error, "Collaboration metrics update failed");
  }
}
