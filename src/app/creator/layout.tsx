import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireRole } from "@/lib/auth/guards";
import { displayName } from "@/lib/format";
import { CREATOR_NAV } from "@/lib/navigation";

type CreatorLayoutProps = {
  children: ReactNode;
};

export default async function CreatorLayout({
  children,
}: CreatorLayoutProps) {
  const user = await requireRole("Creator");
  const name = displayName({
    creator: user.creatorProfile,
    username: user.username,
  });

  return (
    <DashboardShell
      role="Creator"
      userId={user.userId}
      name={name}
      email={user.email}
      navItems={CREATOR_NAV}
    >
      {children}
    </DashboardShell>
  );
}
