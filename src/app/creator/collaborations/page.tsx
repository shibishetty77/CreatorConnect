import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Collaborations",
};

export default function CreatorCollaborationsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Active partnerships"
      title="Collaborations"
      description="Manage the creator-brand agreements that follow an accepted application."
      features={[
        "Track active and completed collaborations.",
        "Review agreed amounts and collaboration dates.",
        "Open contracts and delivery expectations for each brand.",
      ]}
      note="Collaboration management will be connected in a later phase. Current active and completed counts are available on your overview dashboard."
    />
  );
}
