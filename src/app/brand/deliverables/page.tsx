import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Brand deliverables",
};

export default function BrandDeliverablesPage() {
  return (
    <SectionPlaceholder
      eyebrow="Content review"
      title="Deliverables"
      description="Review submitted content, request revisions, and approve delivery."
      features={[
        "See pending submissions across active collaborations.",
        "Approve content or request a revision.",
        "Track due dates and completed deliverables by campaign.",
      ]}
      note="Deliverable review will be connected in a later phase. Recent deliverable activity is already visible on the overview dashboard."
    />
  );
}
