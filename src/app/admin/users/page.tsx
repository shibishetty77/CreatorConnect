import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Admin users",
};

export default function AdminUsersPage() {
  return (
    <SectionPlaceholder
      eyebrow="Account administration"
      title="Users"
      description="Inspect every account on the platform and its assigned role."
      features={[
        "Search and filter users by role or status.",
        "Review account creation dates and profile links.",
        "Apply audited moderation and account actions.",
      ]}
      note="Admin management actions are read-only in Phase 4. Recent account activity is available on the overview dashboard."
    />
  );
}
