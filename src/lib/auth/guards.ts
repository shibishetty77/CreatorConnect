import { redirect } from "next/navigation";

import type { Role } from "./constants";
import { getSession } from "./session";
import type { AuthUser } from "./types";
import { getUserWithProfileById } from "./users";

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return getUserWithProfileById(session.userId);
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(...roles: Role[]): Promise<AuthUser> {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    redirect("/forbidden");
  }

  return user;
}
