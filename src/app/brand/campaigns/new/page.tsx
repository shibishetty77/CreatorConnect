import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandCampaignForm } from "@/components/campaigns/BrandCampaignForm";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireRole } from "@/lib/auth/guards";
import { listCampaignCategoryOptions } from "@/lib/repositories/brand-campaigns";

export const metadata: Metadata = {
  title: "Create campaign",
};

export default async function NewBrandCampaignPage() {
  const user = await requireRole("Brand");
  if (!user.brandProfile) {
    notFound();
  }
  const categories = await listCampaignCategoryOptions();

  return (
    <>
      <PageHeader
        eyebrow="New campaign"
        title="Create campaign"
        description="Publish a campaign brief for creators using a budget and delivery window that fit your plan."
        actions={
          <Link className="btn btn-secondary" href="/brand/campaigns">
            Back to campaigns
          </Link>
        }
      />
      <section className="panel brand-campaign-builder">
        <BrandCampaignForm categories={categories} />
      </section>
    </>
  );
}
