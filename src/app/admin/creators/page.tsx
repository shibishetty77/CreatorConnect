import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Admin creators",
};

export default function AdminCreatorsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Creator oversight"
      title="Creators"
      description="Review creator profiles, social reach, and platform participation."
      features={[
        "Browse creator profiles and linked social accounts.",
        "Review application and collaboration history.",
        "Apply audited moderation actions where required.",
      ]}
      note="Creator administration is read-only in Phase 4. Creator totals and recent platform activity are available on the overview dashboard."
    />
  );
}
