import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Discover campaigns",
};

export default function CreatorCampaignsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Creator campaigns"
      title="Discover campaigns"
      description="Find open briefs that match your audience, niche, and content style."
      features={[
        "Filter campaigns by category, budget, and platform.",
        "Review deliverables and brand requirements before applying.",
        "Submit applications and track their status from one place.",
      ]}
      note="Campaign discovery and application submission will be connected in Phase 5. Your existing applications are already reflected on the overview dashboard."
    />
  );
}
