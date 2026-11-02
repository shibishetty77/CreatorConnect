import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Admin brands",
};

export default function AdminBrandsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Brand oversight"
      title="Brands"
      description="Review brand profiles, campaigns, and sponsorship activity."
      features={[
        "Browse brand profiles and campaign portfolios.",
        "Review application and payment activity by brand.",
        "Apply audited moderation actions where required.",
      ]}
      note="Brand administration is read-only in Phase 4. Brand totals and recent campaign activity are available on the overview dashboard."
    />
  );
}
