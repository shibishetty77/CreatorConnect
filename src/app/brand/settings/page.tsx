import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Brand settings",
};

export default function BrandSettingsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Account settings"
      title="Settings"
      description="Manage brand account preferences, notifications, and security."
      features={[
        "Notification preferences for applications and deliverables.",
        "Password and session security controls.",
        "Team access settings for larger brand teams.",
      ]}
      note="Brand profile details are editable today. Additional settings will be added in a later phase."
    />
  );
}
