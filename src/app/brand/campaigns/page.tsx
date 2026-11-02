import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Brand campaigns",
};

export default function BrandCampaignsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Campaign management"
      title="Campaigns"
      description="Plan, publish, and monitor every brand campaign from one workspace."
      features={[
        "View campaigns by status, budget, and date range.",
        "Open campaign briefs and applicant pipelines.",
        "Archive or close campaigns when delivery is complete.",
      ]}
      note="Campaign creation and management will be connected in Phase 5. Current campaign counts, status mix, and budget totals are available on the overview dashboard."
    />
  );
}
