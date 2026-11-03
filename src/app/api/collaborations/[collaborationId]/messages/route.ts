import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { mongoUnavailable } from "@/lib/api/mongodb";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  createCollaborationMessage,
  listCollaborationMessages,
} from "@/lib/repositories/mongo-platform";
import {
  getCollaborationForActor,
} from "@/lib/repositories/collaborations";
import {
  getCollaborationUserIds,
  recordMongoActivity,
  sendMongoNotification,
} from "@/lib/platform-events";
import { collaborationIdParamSchema } from "@/lib/validations/collaborations";
import { collaborationMessageSchema } from "@/lib/validations/mongo-platform";
import { zodFieldErrors } from "@/lib/validations/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ collaborationId: string }> };

async function getAuthorizedCollaboration(context: RouteContext) {
  const actor = await requireApiRole("Creator", "Brand");
  if (actor.error) return { actor, collaboration: null, id: null } as const;
  if (actor.user.role !== "Creator" && actor.user.role !== "Brand") {
    return {
      actor,
      collaboration: null,
      id: null,
      error: apiError(403, "FORBIDDEN", "Only collaboration participants can access messages."),
    } as const;
  }

  const { collaborationId: rawId } = await context.params;
  const parsedId = collaborationIdParamSchema.safeParse(rawId);
  if (!parsedId.success) {
    return {
      actor,
      collaboration: null,
      id: null,
      error: apiError(400, "INVALID_COLLABORATION_ID", "The collaboration ID is invalid."),
    } as const;
  }
  const profileId =
    actor.user.role === "Creator"
      ? actor.user.creatorProfile?.creatorId
      : actor.user.brandProfile?.brandId;
  if (!profileId) {
    return {
      actor,
      collaboration: null,
      id: null,
      error: missingProfileError(actor.user.role),
    } as const;
  }

  let collaboration: Awaited<ReturnType<typeof getCollaborationForActor>>;
  try {
    collaboration = await getCollaborationForActor({
      collaborationId: parsedId.data,
      role: actor.user.role,
      creatorId: actor.user.role === "Creator" ? profileId : null,
      brandId: actor.user.role === "Brand" ? profileId : null,
    });
  } catch (error) {
    console.error(
      "Collaboration message access check failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return {
      actor,
      collaboration: null,
      id: parsedId.data,
      error: apiError(
        500,
        "COLLABORATION_ACCESS_CHECK_FAILED",
        "We could not verify collaboration access. Please try again.",
      ),
    } as const;
  }
  if (!collaboration) {
    return {
      actor,
      collaboration: null,
      id: parsedId.data,
      error: apiError(404, "COLLABORATION_NOT_FOUND", "This collaboration could not be found."),
    } as const;
  }
  return { actor, collaboration, id: parsedId.data, error: null } as const;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const access = await getAuthorizedCollaboration(context);
  if (access.actor.error) return access.actor.error;
  if (access.error) return access.error;
  if (!access.id || !access.collaboration) {
    return apiError(404, "COLLABORATION_NOT_FOUND", "This collaboration could not be found.");
  }

  try {
    const messages = await listCollaborationMessages(access.id);
    return apiSuccess({ messages });
  } catch (error) {
    return mongoUnavailable(error, "Collaboration messages could not be loaded");
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const guard = mutationGuard(request);
  if (guard) return guard;

  const access = await getAuthorizedCollaboration(context);
  if (access.actor.error) return access.actor.error;
  if (
    access.actor.user.role !== "Creator" &&
    access.actor.user.role !== "Brand"
  ) {
    return apiError(403, "FORBIDDEN", "Only collaboration participants can send messages.");
  }
  const senderRole =
    access.actor.user.role === "Creator" ? "Creator" : "Brand";
  if (access.error) return access.error;
  if (!access.id || !access.collaboration) {
    return apiError(404, "COLLABORATION_NOT_FOUND", "This collaboration could not be found.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
  const parsedBody = collaborationMessageSchema.safeParse(body);
  if (!parsedBody.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please enter a message or valid attachment details.",
      zodFieldErrors(parsedBody.error),
    );
  }

  let participants: Awaited<ReturnType<typeof getCollaborationUserIds>>;
  try {
    participants = await getCollaborationUserIds(access.id);
  } catch (error) {
    console.error(
      "Collaboration participants could not be loaded:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return apiError(
      500,
      "COLLABORATION_PARTICIPANTS_LOAD_FAILED",
      "We could not verify the collaboration participants. Please try again.",
    );
  }
  if (!participants) {
    return apiError(
      404,
      "COLLABORATION_NOT_FOUND",
      "This collaboration could not be found.",
    );
  }

  try {
    const message = await createCollaborationMessage({
      collaborationId: access.id,
      senderId: access.actor.user.userId,
      senderRole,
      ...parsedBody.data,
    });
    const recipientId =
      senderRole === "Creator"
        ? participants.brandUserId
        : participants.creatorUserId;
    const recipientRole =
      senderRole === "Creator" ? "Brand" : "Creator";
    await Promise.all([
      sendMongoNotification({
        userId: recipientId,
        userRole: recipientRole,
        title: "New collaboration message",
        message: `You have a new message about ${participants.campaignName}.`,
        type: "collaboration_message",
        relatedEntityId: access.id,
        relatedEntityType: "collaboration",
        metadata: { messageId: message.id },
        dedupeKey: `message:${message.id}:recipient`,
      }),
      recordMongoActivity({
        actorId: access.actor.user.userId,
        actorRole: senderRole,
        action: "collaboration_message_sent",
        entityType: "collaboration",
        entityId: access.id,
        description: `Sent a message about ${participants.campaignName}.`,
        dedupeKey: `message:${message.id}:activity`,
      }),
    ]);
    return apiSuccess({ message }, 201);
  } catch (error) {
    return mongoUnavailable(error, "Collaboration message could not be sent");
  }
}
