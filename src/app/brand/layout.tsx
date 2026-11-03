import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireRole } from "@/lib/auth/guards";
import { displayName } from "@/lib/format";
import { BRAND_NAV } from "@/lib/navigation";

type BrandLayoutProps = {
  children: ReactNode;
};

export default async function BrandLayout({ children }: BrandLayoutProps) {
  const user = await requireRole("Brand");
  const name = displayName({
    brand: user.brandProfile,
    username: user.username,
  });

  return (
    <DashboardShell
      role="Brand"
      userId={user.userId}
      name={name}
      email={user.email}
      navItems={BRAND_NAV}
    >
      {children}
    </DashboardShell>
  );
}
