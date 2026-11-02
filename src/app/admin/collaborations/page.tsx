import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Admin collaborations",
};

export default function AdminCollaborationsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Collaboration oversight"
      title="Collaborations"
      description="Review creator-brand agreements and delivery outcomes across the platform."
      features={[
        "Inspect collaboration status and agreed amounts.",
        "Review delivery and payment milestones.",
        "Investigate disputed or cancelled collaborations.",
      ]}
      note="Collaboration moderation is read-only in Phase 4. Recent agreements are listed on the overview dashboard."
    />
  );
}
