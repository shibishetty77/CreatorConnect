import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Brand collaborations",
};

export default function BrandCollaborationsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Creator partnerships"
      title="Collaborations"
      description="Track every creator agreement from kickoff to completion."
      features={[
        "View active, completed, and cancelled collaborations.",
        "Review agreed amounts and collaboration dates.",
        "Coordinate contract and delivery milestones.",
      ]}
      note="Collaboration management will be connected in a later phase. Active and completed collaboration counts are available on the overview dashboard."
    />
  );
}
