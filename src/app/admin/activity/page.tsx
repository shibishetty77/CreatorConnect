import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { PlatformActivityPanel } from "@/components/dashboard/PlatformActivityPanel";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Platform activity",
};

export default async function AdminActivityPage() {
  await requireRole("Admin");
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Platform activity"
        description="Inspect the recent platform events recorded in MongoDB."
      />
      <PlatformActivityPanel
        limit={100}
        title="Recent events"
        description="Most recent activity from all creator, brand, and administrator accounts."
      />
    </>
  );
}
