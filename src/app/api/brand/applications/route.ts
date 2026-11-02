import { apiError, apiSuccess } from "@/lib/api/response";
import { missingProfileError, requireApiRole } from "@/lib/auth/api";
import { listBrandApplications } from "@/lib/repositories/brand-applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireApiRole("Brand");

  if (actor.error) {
    return actor.error;
  }

  if (!actor.user.brandProfile) {
    return missingProfileError("Brand");
  }

  try {
    const applications = await listBrandApplications(
      actor.user.brandProfile.brandId,
    );

    return apiSuccess({ applications });
  } catch (error) {
    console.error(
      "Brand applications could not be loaded:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "APPLICATIONS_LOAD_FAILED",
      "We could not load applications. Please try again.",
    );
  }
}
