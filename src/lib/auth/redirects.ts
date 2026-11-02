import { dashboardForRole, type Role } from "./constants";

const ROLE_PREFIX: Record<Role, string> = {
  Creator: "/creator",
  Brand: "/brand",
  Admin: "/admin",
};

export function safeRedirectForRole(
  nextPath: string | undefined,
  role: Role,
): string {
  const fallback = dashboardForRole(role);

  if (
    !nextPath ||
    !nextPath.startsWith("/") ||
    nextPath.startsWith("//") ||
    nextPath.includes("\\")
  ) {
    return fallback;
  }

  const prefix = ROLE_PREFIX[role];

  return nextPath === prefix || nextPath.startsWith(`${prefix}/`)
    ? nextPath
    : fallback;
}
