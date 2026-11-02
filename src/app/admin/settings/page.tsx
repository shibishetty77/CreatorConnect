import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Admin settings",
};

export default function AdminSettingsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Platform settings"
      title="Settings"
      description="Manage platform-wide configuration, policies, and administrator security."
      features={[
        "Configure marketplace and moderation policies.",
        "Review administrator security and session controls.",
        "Manage platform notification defaults.",
      ]}
      note="Platform configuration will be added in a later phase. All current admin views remain read-only."
    />
  );
}
