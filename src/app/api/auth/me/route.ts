import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(401, "UNAUTHENTICATED", "You are not signed in.");
    }

    return apiSuccess({ user });
  } catch (error) {
    console.error(
      "Profile lookup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "PROFILE_LOOKUP_FAILED",
      "We could not load your account.",
    );
  }
}
