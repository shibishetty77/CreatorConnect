import type { Metadata } from "next";

import { AdminDirectoryFilters } from "@/components/admin/AdminDirectoryFilters";
import { AdminDirectoryTable } from "@/components/admin/AdminDirectoryTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireRole } from "@/lib/auth/guards";
import { formatNumber } from "@/lib/format";
import { listAdminCreators } from "@/lib/repositories/admin-directories";

export const metadata: Metadata = {
  title: "Admin creators",
};

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function AdminCreatorsPage({ searchParams }: PageProps) {
  await requireRole("Admin");
  const { q = "" } = await searchParams;
  const creators = await listAdminCreators(q);

  return (
    <>
      <PageHeader eyebrow="Creator directory" title="Creators" description="Read-only directory of creator participation and social reach." />
      <section className="panel"><AdminDirectoryFilters action="/admin/creators" search={q} searchLabel="Name or username" /></section>
      <section className="panel">
        <p className="panel-note">Showing up to 100 creators. No contact details are included.</p>
        <AdminDirectoryTable
          caption="Creators"
          columns={[
            { key: "creator", label: "Creator" },
            { key: "location", label: "Location" },
            { key: "accounts", label: "Social accounts" },
            { key: "followers", label: "Followers" },
            { key: "applications", label: "Applications" },
            { key: "collaborations", label: "Collaborations" },
          ]}
          rows={creators.map((creator) => ({
            key: String(creator.creatorId),
            cells: [
              <><strong>{creator.name}</strong><span className="table-subtext">@{creator.username}</span></>,
              [creator.city, creator.state].filter(Boolean).join(", ") || "Not set",
              formatNumber(creator.socialAccounts),
              formatNumber(creator.followers),
              formatNumber(creator.applications),
              formatNumber(creator.collaborations),
            ],
          }))}
          emptyMessage="No creators found."
        />
      </section>
    </>
  );
}
