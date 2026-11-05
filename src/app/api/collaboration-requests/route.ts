import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import { recordCollaborationRequestCreated } from "@/lib/platform-events";
import {
  CollaborationRequestError,
  createCollaborationRequest,
  listCollaborationRequestOptions,
  listCollaborationRequestsForActor,
} from "@/lib/repositories/collaborations";
import { zodFieldErrors } from "@/lib/validations/auth";
import { collaborationRequestCreateSchema } from "@/lib/validations/collaborations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Creator", "Brand");

  if (actor.error) {
    return actor.error;
  }

  const role = actor.user.role;
  const creatorId = actor.user.creatorProfile?.creatorId ?? null;
  const brandId = actor.user.brandProfile?.brandId ?? null;

  if (role === "Creator" && creatorId === null) {
    return missingProfileError("Creator");
  }

  if (role === "Brand" && brandId === null) {
    return missingProfileError("Brand");
  }

  try {
    const [requests, options] = await Promise.all([
      listCollaborationRequestsForActor({ role, creatorId, brandId }),
      listCollaborationRequestOptions({ role, brandId }),
    ]);

    return apiSuccess({ ...requests, options });
  } catch (error) {
    console.error(
      "Collaboration requests could not be loaded:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "COLLABORATION_REQUESTS_LOAD_FAILED",
      "We could not load collaboration requests. Please try again.",
    );
  }
}

export async function POST(request: NextRequest) {
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const parsed = collaborationRequestCreateSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  if (role === "Brand" && !parsed.data.creatorId) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Choose a creator for this collaboration.",
      { creatorId: "Choose a creator for this collaboration." },
    );
  }

  if (role === "Creator" && !parsed.data.brandId) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Choose a brand for this proposal.",
      { brandId: "Choose a brand for this proposal." },
    );
  }

  try {
    const created = await createCollaborationRequest({
      role,
      brandId: actor.user.brandProfile?.brandId ?? null,
      creatorId: actor.user.creatorProfile?.creatorId ?? null,
      request: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        deliverableDescription: parsed.data.deliverableDescription,
        additionalRequirements: parsed.data.additionalRequirements ?? null,
        agreedAmount: parsed.data.agreedAmount,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        campaignId: parsed.data.campaignId,
        brandId: parsed.data.brandId ?? null,
        creatorId: parsed.data.creatorId ?? null,
      },
    });

    await recordCollaborationRequestCreated({
      collaborationId: created.collaborationId,
      actorUserId: actor.user.userId,
      actorRole: role,
    });

    return apiSuccess({ request: created }, 201);
  } catch (error) {
    if (error instanceof CollaborationRequestError) {
      const status =
        error.code === "REQUEST_ACCESS_DENIED"
          ? 403
          : error.code === "REQUEST_NOT_FOUND" ||
              error.code === "REQUEST_CAMPAIGN_NOT_FOUND" ||
              error.code === "REQUEST_CREATOR_NOT_FOUND" ||
              error.code === "REQUEST_BRAND_NOT_FOUND"
            ? 404
            : 409;
      return apiError(status, error.code, error.message);
    }

    console.error(
      "Collaboration request creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "COLLABORATION_REQUEST_CREATE_FAILED",
      "We could not create this collaboration request. Please try again.",
    );
  }
}
