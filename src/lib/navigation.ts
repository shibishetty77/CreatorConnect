export type NavIconName =
  | "overview"
  | "discover"
  | "applications"
  | "collaborations"
  | "deliverables"
  | "payments"
  | "profile"
  | "settings"
  | "campaigns"
  | "create"
  | "users"
  | "creators"
  | "brands";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
};

export const CREATOR_NAV: NavItem[] = [
  { href: "/creator/dashboard", label: "Overview", icon: "overview" },
  { href: "/creator/campaigns", label: "Discover Campaigns", icon: "discover" },
  {
    href: "/creator/applications",
    label: "My Applications",
    icon: "applications",
  },
  {
    href: "/creator/collaborations",
    label: "Collaborations",
    icon: "collaborations",
  },
  {
    href: "/creator/deliverables",
    label: "Deliverables",
    icon: "deliverables",
  },
  { href: "/creator/payments", label: "Payments", icon: "payments" },
  { href: "/creator/profile", label: "My Profile", icon: "profile" },
  { href: "/creator/settings", label: "Settings", icon: "settings" },
];

export const BRAND_NAV: NavItem[] = [
  { href: "/brand/dashboard", label: "Overview", icon: "overview" },
  { href: "/brand/campaigns", label: "My Campaigns", icon: "campaigns" },
  {
    href: "/brand/campaigns/new",
    label: "Create Campaign",
    icon: "create",
  },
  {
    href: "/brand/applications",
    label: "Creator Applications",
    icon: "applications",
  },
  {
    href: "/brand/collaborations",
    label: "Collaborations",
    icon: "collaborations",
  },
  {
    href: "/brand/deliverables",
    label: "Deliverables",
    icon: "deliverables",
  },
  { href: "/brand/payments", label: "Payments", icon: "payments" },
  { href: "/brand/profile", label: "Brand Profile", icon: "profile" },
  { href: "/brand/settings", label: "Settings", icon: "settings" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Overview", icon: "overview" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/creators", label: "Creators", icon: "creators" },
  { href: "/admin/brands", label: "Brands", icon: "brands" },
  { href: "/admin/campaigns", label: "Campaigns", icon: "campaigns" },
  { href: "/admin/reports", label: "Reports", icon: "overview" },
  { href: "/admin/categories", label: "Categories", icon: "settings" },
  {
    href: "/admin/collaborations",
    label: "Collaborations",
    icon: "collaborations",
  },
  { href: "/admin/payments", label: "Payments", icon: "payments" },
  { href: "/admin/reviews", label: "Reviews", icon: "applications" },
  { href: "/admin/system", label: "System status", icon: "settings" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

export function activeNavigationHref(
  items: NavItem[],
  pathname: string,
): string | null {
  let active: string | null = null;

  for (const item of items) {
    const matches =
      pathname === item.href || pathname.startsWith(`${item.href}/`);

    if (matches && (!active || item.href.length > active.length)) {
      active = item.href;
    }
  }

  return active;
}
