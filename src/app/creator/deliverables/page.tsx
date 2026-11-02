import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Deliverables",
};

export default function CreatorDeliverablesPage() {
  return (
    <SectionPlaceholder
      eyebrow="Content delivery"
      title="Deliverables"
      description="Keep every content submission, due date, and approval status visible."
      features={[
        "See pending and completed deliverables by campaign.",
        "Upload content and respond to revision requests.",
        "Track approval status after brand review.",
      ]}
      note="Deliverable submission and review will be connected in a later phase. Your current deliverable counts are summarized on the overview dashboard."
    />
  );
}
