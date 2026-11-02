import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Admin campaigns",
};

export default function AdminCampaignsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Campaign oversight"
      title="Campaigns"
      description="Monitor campaign health, status, budgets, and marketplace activity."
      features={[
        "Review all campaigns by brand and status.",
        "Inspect budgets, timelines, and application volume.",
        "Intervene in campaigns that breach platform policy.",
      ]}
      note="Campaign moderation is read-only in Phase 4. The latest campaigns and status mix are available on the overview dashboard."
    />
  );
}
