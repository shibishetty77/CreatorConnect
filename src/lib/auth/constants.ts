export const ROLES = ["Creator", "Brand", "Admin"] as const;

export type Role = (typeof ROLES)[number];

export const PUBLIC_ROLES = ["Creator", "Brand"] as const;

export type PublicRole = (typeof PUBLIC_ROLES)[number];

export const SESSION_COOKIE_NAME = "cc_session";

export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const DASHBOARD_BY_ROLE: Record<Role, string> = {
  Creator: "/creator/dashboard",
  Brand: "/brand/dashboard",
  Admin: "/admin/dashboard",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export function isPublicRole(value: unknown): value is PublicRole {
  return (
    typeof value === "string" && PUBLIC_ROLES.includes(value as PublicRole)
  );
}

export function dashboardForRole(role: Role): string {
  return DASHBOARD_BY_ROLE[role];
}

export function getSessionTtlSeconds(): number {
  const configured = process.env.AUTH_SESSION_TTL_SECONDS?.trim();

  if (!configured) {
    return DEFAULT_SESSION_TTL_SECONDS;
  }

  const value = Number(configured);

  if (!Number.isInteger(value) || value < 60 || value > 60 * 60 * 24 * 30) {
    throw new Error(
      "AUTH_SESSION_TTL_SECONDS must be an integer between 60 and 2592000.",
    );
  }

  return value;
}
