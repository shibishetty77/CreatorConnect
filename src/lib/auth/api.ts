import type { NextResponse } from "next/server";

import { apiError } from "@/lib/api/response";
import type { Role } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/guards";
import type { AuthUser } from "@/lib/auth/types";

type ApiActorResult =
  | { user: AuthUser; error: null }
  | { user: null; error: NextResponse };

export async function requireApiRole(
  ...roles: Role[]
): Promise<ApiActorResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      error: apiError(401, "UNAUTHENTICATED", "Sign in to continue."),
    };
  }

  if (!roles.includes(user.role)) {
    return {
      user: null,
      error: apiError(
        403,
        "FORBIDDEN",
        "You do not have access to this resource.",
      ),
    };
  }

  return { user, error: null };
}

export function missingProfileError(role: string): NextResponse {
  return apiError(
    409,
    "PROFILE_MISSING",
    `${role} profile is missing for this account.`,
  );
}
