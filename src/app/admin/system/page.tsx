import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { AdminSystemWorkspace } from "@/components/admin/AdminSystemWorkspace";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Admin system status",
};

export default async function AdminSystemPage() {
  await requireRole("Admin");

  return (
    <>
      <PageHeader
        eyebrow="Database health"
        title="System status"
        description="Read-only database connectivity and schema-object visibility. No schema or data changes are made here."
      />
      <AdminSystemWorkspace />
    </>
  );
}
