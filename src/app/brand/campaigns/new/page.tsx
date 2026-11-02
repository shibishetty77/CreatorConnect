import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Create campaign",
};

export default function NewBrandCampaignPage() {
  return (
    <SectionPlaceholder
      eyebrow="New campaign"
      title="Create campaign"
      description="Turn a brief into a structured campaign that creators can apply to."
      features={[
        "Set the campaign category, budget, and delivery window.",
        "Define platform requirements and required deliverables.",
        "Publish the campaign to the creator marketplace.",
      ]}
      note="The campaign builder will be delivered in Phase 5. No campaign records are created from this page yet."
    />
  );
}
