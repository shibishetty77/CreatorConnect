import type { Metadata } from "next";

import { CampaignDiscovery } from "@/components/campaigns/CampaignDiscovery";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Discover campaigns",
};

export default function CreatorCampaignsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Creator campaigns"
        title="Discover campaigns"
        description="Review open campaign briefs and apply when your social accounts meet the stated requirements."
      />
      <CampaignDiscovery />
    </>
  );
}
