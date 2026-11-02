import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "My applications",
};

export default function CreatorApplicationsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Application pipeline"
      title="My applications"
      description="Review every application you have submitted and where it stands."
      features={[
        "See pending, accepted, and rejected applications.",
        "Open the campaign brief behind each application.",
        "Withdraw or resubmit applications where the workflow allows.",
      ]}
      note="The full application workspace arrives in Phase 5. The overview dashboard already shows your seeded application totals and recent application activity."
    />
  );
}
