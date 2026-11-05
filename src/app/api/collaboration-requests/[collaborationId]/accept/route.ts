import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { recordCollaborationRequestDecision } from "@/lib/platform-events";
import {
  CollaborationRequestError,
  decideCollaborationRequest,
} from "@/lib/repositories/collaborations";
import { collaborationIdParamSchema } from "@/lib/validations/collaborations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CollaborationRouteContext = {
  params: Promise<{ collaborationId: string }>;
};

export async function POST(
  request: NextRequest,
  context: CollaborationRouteContext,
) {
  const guard = mutationGuard(request);

  if (guard) {
    return guard;
  }

  const actor = await requireApiRole("Creator", "Brand");

  if (actor.error) {
    return actor.error;
  }

  const role: "Creator" | "Brand" =
    actor.user.role === "Creator" ? "Creator" : "Brand";

  if (role === "Creator" && !actor.user.creatorProfile) {
    return missingProfileError("Creator");
  }

  if (role === "Brand" && !actor.user.brandProfile) {
    return missingProfileError("Brand");
  }

  const { collaborationId: rawCollaborationId } = await context.params;
  const parsedId = collaborationIdParamSchema.safeParse(rawCollaborationId);

  if (!parsedId.success) {
    return apiError(
      400,
      "INVALID_COLLABORATION_ID",
      "The collaboration ID must be a positive integer.",
    );
  }

  try {
    const decided = await decideCollaborationRequest({
      collaborationId: parsedId.data,
      role,
      brandId: actor.user.brandProfile?.brandId ?? null,
      creatorId: actor.user.creatorProfile?.creatorId ?? null,
      decision: "Accepted",
    });

    await recordCollaborationRequestDecision({
      collaborationId: decided.collaborationId,
      decision: "Accepted",
      actorUserId: actor.user.userId,
      actorRole: role,
    });

    return apiSuccess({ request: decided });
  } catch (error) {
    if (error instanceof CollaborationRequestError) {
      const status =
        error.code === "REQUEST_ACCESS_DENIED"
          ? 403
          : error.code === "REQUEST_NOT_FOUND"
            ? 404
            : 409;
      return apiError(status, error.code, error.message);
    }

    console.error(
      "Collaboration request acceptance failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "COLLABORATION_REQUEST_ACCEPT_FAILED",
      "We could not accept this collaboration request. Please try again.",
    );
  }
}
