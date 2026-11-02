import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  CollaborationUpdateError,
  getCollaborationForActor,
  updateCollaborationForActor,
} from "@/lib/repositories/collaborations";
import { zodFieldErrors } from "@/lib/validations/auth";
import {
  collaborationIdParamSchema,
  collaborationUpdateSchema,
} from "@/lib/validations/collaborations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CollaborationRouteContext = {
  params: Promise<{ collaborationId: string }>;
};

async function getActorScope(role: string, user: {
  creatorProfile: { creatorId: number } | null;
  brandProfile: { brandId: number } | null;
}) {
  if (role === "Creator") {
    return user.creatorProfile
      ? { creatorId: user.creatorProfile.creatorId, brandId: null }
      : null;
  }

  if (role === "Brand") {
    return user.brandProfile
      ? { creatorId: null, brandId: user.brandProfile.brandId }
      : null;
  }

  return { creatorId: null, brandId: null };
}

export async function GET(
  _request: NextRequest,
  context: CollaborationRouteContext,
) {
  const actor = await requireApiRole("Creator", "Brand", "Admin");

  if (actor.error) {
    return actor.error;
  }

  const scope = await getActorScope(actor.user.role, actor.user);

  if (!scope) {
    return missingProfileError(actor.user.role);
  }

  const { collaborationId: rawId } = await context.params;
  const parsedId = collaborationIdParamSchema.safeParse(rawId);

  if (!parsedId.success) {
    return apiError(
      400,
      "INVALID_COLLABORATION_ID",
      "The collaboration ID must be a positive integer.",
    );
  }

  try {
    const collaboration = await getCollaborationForActor({
      collaborationId: parsedId.data,
      role: actor.user.role,
      ...scope,
    });

    if (!collaboration) {
      return apiError(
        404,
        "COLLABORATION_NOT_FOUND",
        "This collaboration could not be found.",
      );
    }

    return apiSuccess({ collaboration });
  } catch (error) {
    console.error(
      "Collaboration detail could not be loaded:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "COLLABORATION_LOAD_FAILED",
      "We could not load this collaboration. Please try again.",
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: CollaborationRouteContext,
) {
  const guard = mutationGuard(request);

  if (guard) {
    return guard;
  }

  const actor = await requireApiRole("Brand", "Admin");

  if (actor.error) {
    return actor.error;
  }

  if (actor.user.role === "Brand" && !actor.user.brandProfile) {
    return missingProfileError("Brand");
  }

  const { collaborationId: rawId } = await context.params;
  const parsedId = collaborationIdParamSchema.safeParse(rawId);

  if (!parsedId.success) {
    return apiError(
      400,
      "INVALID_COLLABORATION_ID",
      "The collaboration ID must be a positive integer.",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const parsedBody = collaborationUpdateSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsedBody.error),
    );
  }

  try {
    const collaboration = await updateCollaborationForActor({
      collaborationId: parsedId.data,
      role: actor.user.role,
      brandId: actor.user.brandProfile?.brandId ?? null,
      updates: parsedBody.data,
    });

    return apiSuccess({ collaboration });
  } catch (error) {
    if (error instanceof CollaborationUpdateError) {
      const status =
        error.code === "COLLABORATION_NOT_FOUND"
          ? 404
          : error.code === "COLLABORATION_ACCESS_DENIED"
            ? 403
            : 409;
      return apiError(status, error.code, error.message);
    }

    console.error(
      "Collaboration update failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "COLLABORATION_UPDATE_FAILED",
      "We could not update this collaboration. Please try again.",
    );
  }
}
