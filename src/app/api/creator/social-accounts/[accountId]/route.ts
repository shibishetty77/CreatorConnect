import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { mutationGuard } from "@/lib/auth/csrf";
import {
  deleteSocialAccount,
  updateSocialAccount,
} from "@/lib/repositories/creator-profiles";
import { zodFieldErrors } from "@/lib/validations/auth";
import { socialAccountSchema } from "@/lib/validations/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SocialAccountRouteContext = {
  params: Promise<{ accountId: string }>;
};

function parseAccountId(value: string): number | null {
  const accountId = Number(value);

  return Number.isInteger(accountId) && accountId > 0 ? accountId : null;
}

export async function PATCH(
  request: NextRequest,
  context: SocialAccountRouteContext,
) {
  const guard = mutationGuard(request);

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

  const { accountId: rawAccountId } = await context.params;
  const accountId = parseAccountId(rawAccountId);

  if (!accountId) {
    return apiError(
      400,
      "INVALID_ACCOUNT_ID",
      "The social account ID is invalid.",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const parsed = socialAccountSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    const account = await updateSocialAccount(
      actor.user.creatorProfile.creatorId,
      accountId,
      parsed.data,
    );

    if (!account) {
      return apiError(
        404,
        "SOCIAL_ACCOUNT_NOT_FOUND",
        "This social account was not found.",
      );
    }

    return apiSuccess({ account });
  } catch (error) {
    console.error(
      "Social account update failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "SOCIAL_ACCOUNT_UPDATE_FAILED",
      "We could not update this social account. Please try again.",
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: SocialAccountRouteContext,
) {
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

  const { accountId: rawAccountId } = await context.params;
  const accountId = parseAccountId(rawAccountId);

  if (!accountId) {
    return apiError(
      400,
      "INVALID_ACCOUNT_ID",
      "The social account ID is invalid.",
    );
  }

  try {
    const deleted = await deleteSocialAccount(
      actor.user.creatorProfile.creatorId,
      accountId,
    );

    if (!deleted) {
      return apiError(
        404,
        "SOCIAL_ACCOUNT_NOT_FOUND",
        "This social account was not found.",
      );
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error(
      "Social account deletion failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "SOCIAL_ACCOUNT_DELETE_FAILED",
      "We could not remove this social account. Please try again.",
    );
  }
}
