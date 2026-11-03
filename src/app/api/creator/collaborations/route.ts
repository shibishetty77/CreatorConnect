import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { listCreatorCollaborationsPage } from "@/lib/repositories/collaborations";
import { zodFieldErrors } from "@/lib/validations/auth";
import { creatorCollaborationQuerySchema } from "@/lib/validations/collaborations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const actor = await requireApiRole("Creator");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.creatorProfile) {
    return missingProfileError("Creator");
  }

  const rawQuery: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (value !== "") {
      rawQuery[key] = value;
    }
  }

  const parsed = creatorCollaborationQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_FILTERS",
      "Please correct the collaboration filters.",
      zodFieldErrors(parsed.error),
    );
  }

  try {
    const page = await listCreatorCollaborationsPage(
      actor.user.creatorProfile.creatorId,
      parsed.data,
    );

    return apiSuccess(page);
  } catch (error) {
    console.error(
      "Creator collaborations could not be loaded:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "COLLABORATIONS_LOAD_FAILED",
      "We could not load collaborations. Please try again.",
    );
  }
}
