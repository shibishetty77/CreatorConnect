import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { mutationGuard } from "@/lib/auth/csrf";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = mutationGuard(request, { requireJson: false });

  if (guard) {
    return guard;
  }

  try {
    await clearSessionCookie();
    return apiSuccess({ loggedOut: true });
  } catch (error) {
    console.error(
      "Logout failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return apiError(
      500,
      "LOGOUT_FAILED",
      "We could not complete sign-out. Please try again.",
    );
  }
}
