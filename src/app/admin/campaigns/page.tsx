import type { Metadata } from "next";
import Link from "next/link";

import { AdminDirectoryFilters } from "@/components/admin/AdminDirectoryFilters";
import { AdminDirectoryTable } from "@/components/admin/AdminDirectoryTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { listAdminCampaigns } from "@/lib/repositories/admin-directories";

export const metadata: Metadata = {
  title: "Admin campaigns",
};

type PageProps = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function AdminCampaignsPage({ searchParams }: PageProps) {
  await requireRole("Admin");
  const params = await searchParams;
  const search = params.q?.slice(0, 100) ?? "";
  const status = params.status ?? "";
  const campaigns = await listAdminCampaigns({ search, status });

  return (
    <>
      <PageHeader eyebrow="Campaign oversight" title="Campaigns" description="Read-only campaign directory with application and collaboration activity." />
      <section className="panel">
        <AdminDirectoryFilters
          action="/admin/campaigns"
          search={search}
          searchLabel="Campaign or brand"
          filterName="status"
          filterLabel="Status"
          filterValue={status}
          filterOptions={[
            { value: "", label: "All statuses" },
            { value: "Open", label: "Open" },
            { value: "Ongoing", label: "Ongoing" },
            { value: "Completed", label: "Completed" },
          ]}
        />
      </section>
      <section className="panel">
        <AdminDirectoryTable
          caption="Campaign directory"
          columns={[
            { key: "campaign", label: "Campaign" },
            { key: "category", label: "Category" },
            { key: "budget", label: "Budget" },
            { key: "dates", label: "Dates" },
            { key: "applications", label: "Applications" },
            { key: "collaborations", label: "Collaborations" },
            { key: "status", label: "Status" },
            { key: "report", label: "Report" },
          ]}
          rows={campaigns.map((campaign) => ({
            key: String(campaign.campaignId),
            cells: [
              <><strong>{campaign.campaignName}</strong><span className="table-subtext">{campaign.brandName}</span></>,
              campaign.categoryName ?? "Uncategorized",
              formatCurrency(campaign.budget),
              `${formatDate(campaign.startDate)} – ${formatDate(campaign.endDate)}`,
              formatNumber(campaign.applications),
              formatNumber(campaign.collaborations),
              <StatusBadge key={`status-${campaign.campaignId}`} status={campaign.status} />,
              <Link className="panel-link" href={`/admin/campaigns/${campaign.campaignId}`} key={`report-${campaign.campaignId}`}>View</Link>,
            ],
          }))}
          emptyMessage="No campaigns found."
        />
      </section>
    </>
  );
}
