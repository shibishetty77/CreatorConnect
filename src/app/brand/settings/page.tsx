import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Brand settings",
};

export default function BrandSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Account settings"
        title="Settings"
        description="Manage the brand details currently supported by CreatorConnect."
      />
      <section className="panel brand-settings-panel">
        <div>
          <h2>Brand profile</h2>
          <p>
            Update the brand name, industry, contact number, and location shown
            to creators.
          </p>
          <Link className="btn btn-primary" href="/brand/profile">
            Edit brand profile
          </Link>
        </div>
        <p className="panel-note">
          Notification preferences, team access, and brand-specific password
          controls are not available in the current workspace.
        </p>
      </section>
    </>
  );
}
