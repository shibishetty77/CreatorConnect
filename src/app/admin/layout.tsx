import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireRole } from "@/lib/auth/guards";
import { displayName } from "@/lib/format";
import { ADMIN_NAV } from "@/lib/navigation";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await requireRole("Admin");
  const name = displayName({
    username: user.username,
  });

  return (
    <DashboardShell
      role="Admin"
      userId={user.userId}
      name={name}
      email={user.email}
      navItems={ADMIN_NAV}
    >
      {children}
    </DashboardShell>
  );
}
