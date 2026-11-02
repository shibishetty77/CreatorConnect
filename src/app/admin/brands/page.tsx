import type { Metadata } from "next";

import { AdminDirectoryFilters } from "@/components/admin/AdminDirectoryFilters";
import { AdminDirectoryTable } from "@/components/admin/AdminDirectoryTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireRole } from "@/lib/auth/guards";
import { formatNumber } from "@/lib/format";
import { listAdminBrands } from "@/lib/repositories/admin-directories";

export const metadata: Metadata = {
  title: "Admin brands",
};

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function AdminBrandsPage({ searchParams }: PageProps) {
  await requireRole("Admin");
  const { q = "" } = await searchParams;
  const brands = await listAdminBrands(q);

  return (
    <>
      <PageHeader eyebrow="Brand directory" title="Brands" description="Read-only brand directory with campaign and collaboration counts." />
      <section className="panel"><AdminDirectoryFilters action="/admin/brands" search={q} searchLabel="Brand or industry" /></section>
      <section className="panel">
        <p className="panel-note">Showing up to 100 brands. Account contact details are not included.</p>
        <AdminDirectoryTable
          caption="Brands"
          columns={[
            { key: "brand", label: "Brand" },
            { key: "industry", label: "Industry" },
            { key: "location", label: "Location" },
            { key: "campaigns", label: "Campaigns" },
            { key: "collaborations", label: "Collaborations" },
          ]}
          rows={brands.map((brand) => ({
            key: String(brand.brandId),
            cells: [
              brand.brandName,
              brand.industry ?? "Not set",
              [brand.city, brand.state].filter(Boolean).join(", ") || "Not set",
              formatNumber(brand.campaigns),
              formatNumber(brand.collaborations),
            ],
          }))}
          emptyMessage="No brands found."
        />
      </section>
    </>
  );
}
