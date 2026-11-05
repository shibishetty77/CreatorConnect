import type { Metadata } from "next";
import Link from "next/link";

import { BrandCampaigns } from "@/components/campaigns/BrandCampaigns";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Brand campaigns",
};

export default function BrandCampaignsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Campaign management"
        title="My campaigns"
        description="Manage your campaign briefs, review applications, and track each campaign's status."
        actions={
          <Link className="btn btn-primary" href="/brand/campaigns/new">
            + Create Campaign
          </Link>
        }
      />
      <BrandCampaigns />
    </>
  );
}
