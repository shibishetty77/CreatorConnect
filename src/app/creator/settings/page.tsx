import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Creator settings",
};

export default function CreatorSettingsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Account settings"
      title="Settings"
      description="Manage account preferences, notifications, and security."
      features={[
        "Notification preferences for applications and payments.",
        "Password and session security controls.",
        "Account visibility and availability preferences.",
      ]}
      note="Profile details and social accounts are editable today. Additional settings will be added in a later phase."
    />
  );
}
