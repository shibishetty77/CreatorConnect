import type { Metadata } from "next";

import { AdminReviewsWorkspace } from "@/components/admin/AdminReviewsWorkspace";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireRole } from "@/lib/auth/guards";
import { listAdminReviews } from "@/lib/repositories/admin-directories";

export const metadata: Metadata = {
  title: "Admin reviews",
};

export default async function AdminReviewsPage() {
  await requireRole("Admin");
  const reviews = await listAdminReviews();

  return (
    <>
      <PageHeader
        eyebrow="Review moderation"
        title="Reviews"
        description="Review collaboration ratings and remove inappropriate feedback."
      />
      <section className="panel">
        <AdminReviewsWorkspace initialReviews={reviews} />
      </section>
    </>
  );
}
