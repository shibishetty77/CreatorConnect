import type { Metadata } from "next";
import Link from "next/link";

import { AdminDirectoryFilters } from "@/components/admin/AdminDirectoryFilters";
import { AdminDirectoryTable } from "@/components/admin/AdminDirectoryTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import { formatCurrency, formatDate } from "@/lib/format";
import { listAdminCollaborations } from "@/lib/repositories/admin-directories";

export const metadata: Metadata = {
  title: "Admin collaborations",
};

type PageProps = { searchParams: Promise<{ status?: string }> };

export default async function AdminCollaborationsPage({ searchParams }: PageProps) {
  await requireRole("Admin");
  const { status = "" } = await searchParams;
  const collaborations = await listAdminCollaborations(status);

  return (
    <>
      <PageHeader eyebrow="Collaboration oversight" title="Collaborations" description="Read-only list of accepted creator-brand agreements and their current status." />
      <section className="panel">
        <AdminDirectoryFilters
          action="/admin/collaborations"
          filterName="status"
          filterLabel="Status"
          filterValue={status}
          filterOptions={[
            { value: "", label: "All statuses" },
            { value: "Active", label: "Active" },
            { value: "Completed", label: "Completed" },
          ]}
        />
      </section>
      <section className="panel">
        <AdminDirectoryTable
          caption="Platform collaborations"
          columns={[
            { key: "creator", label: "Creator" },
            { key: "campaign", label: "Campaign" },
            { key: "brand", label: "Brand" },
            { key: "amount", label: "Agreed amount" },
            { key: "dates", label: "Dates" },
            { key: "status", label: "Status" },
          ]}
          rows={collaborations.map((collaboration) => ({
            key: String(collaboration.collaborationId),
            cells: [
              <Link href={`/admin/collaborations/${collaboration.collaborationId}`} key={`collaboration-${collaboration.collaborationId}`}>
                {collaboration.creatorName}
              </Link>,
              collaboration.campaignName,
              collaboration.brandName,
              formatCurrency(collaboration.agreedAmount),
              `${formatDate(collaboration.startDate)} – ${formatDate(collaboration.endDate)}`,
              <StatusBadge key={collaboration.status} status={collaboration.status} />,
            ],
          }))}
          emptyMessage="No collaborations found."
        />
      </section>
    </>
  );
}
