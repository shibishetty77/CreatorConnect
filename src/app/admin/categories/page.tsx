import type { Metadata } from "next";

import { AdminCategoriesWorkspace } from "@/components/admin/AdminCategoriesWorkspace";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Admin categories",
};

export default async function AdminCategoriesPage() {
  await requireRole("Admin");

  return (
    <>
      <PageHeader
        eyebrow="Campaign configuration"
        title="Categories"
        description="Create and rename campaign categories. Categories in use by campaigns cannot be deleted."
      />
      <AdminCategoriesWorkspace />
    </>
  );
}
