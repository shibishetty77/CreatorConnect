import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { AdminReportsWorkspace } from "@/components/admin/AdminReportsWorkspace";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Admin reports",
};

export default async function AdminReportsPage() {
  await requireRole("Admin");

  return (
    <>
      <PageHeader
        eyebrow="Platform reporting"
        title="Reports"
        description="Live aggregates from campaigns, applications, collaborations, payments, and recorded performance."
      />
      <AdminReportsWorkspace />
    </>
  );
}
