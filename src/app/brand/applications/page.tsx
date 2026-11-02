import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Brand applications",
};

export default function BrandApplicationsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Creator pipeline"
      title="Applications"
      description="Review creator applications across all of your campaigns."
      features={[
        "Compare creator profiles, reach, and engagement.",
        "Accept or reject pending applications.",
        "Move accepted creators into active collaborations.",
      ]}
      note="Application review will be connected in Phase 5. Current application totals and recent application activity are available on the overview dashboard."
    />
  );
}
