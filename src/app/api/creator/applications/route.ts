import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { listCreatorApplications } from "@/lib/repositories/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Creator");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.creatorProfile) {
    return missingProfileError("Creator");
  }

  try {
    const applications = await listCreatorApplications(
      actor.user.creatorProfile.creatorId,
    );

    return apiSuccess({ applications });
  } catch (error) {
    console.error(
      "Creator applications could not be loaded:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "APPLICATIONS_LOAD_FAILED",
      "We could not load your applications. Please try again.",
    );
  }
}
