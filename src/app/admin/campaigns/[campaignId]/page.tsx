import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getAdminCampaignReport } from "@/lib/repositories/admin-reports";
import { financeIdParamSchema } from "@/lib/validations/finance";

export const metadata: Metadata = {
  title: "Campaign report",
};

type PageProps = { params: Promise<{ campaignId: string }> };

export default async function AdminCampaignReportPage({ params }: PageProps) {
  await requireRole("Admin");
  const { campaignId: rawId } = await params;
  const parsedId = financeIdParamSchema.safeParse(rawId);
  if (!parsedId.success) notFound();

  const report = await getAdminCampaignReport(parsedId.data);
  if (!report) notFound();

  return (
    <>
      <PageHeader
        eyebrow={`${report.brandName}${report.categoryName ? ` · ${report.categoryName}` : ""}`}
        title={report.campaignName}
        description={report.description ?? "Campaign performance and collaboration report."}
        actions={<Link className="btn btn-secondary" href="/admin/reports">Back to reports</Link>}
      />
      <div className="stats-grid">
        <StatCard metricKey="admin.campaign.applications" label="Applications" value={formatNumber(report.applications.reduce((sum, item) => sum + item.count, 0))} />
        <StatCard metricKey="admin.campaign.collaborations" label="Collaborations" value={formatNumber(report.collaborations.reduce((sum, item) => sum + item.count, 0))} />
        <StatCard metricKey="admin.campaign.paid" label="Paid" value={formatCurrency(report.payments.paidTotal)} />
        <StatCard metricKey="admin.campaign.rating" label="Average rating" value={report.averageRating === null ? "Unavailable" : `${Number(report.averageRating).toFixed(2)} / 5`} hint={`${report.reviewCount} reviews`} />
      </div>

      <div className="panel-grid">
        <section className="panel">
          <div className="panel-header"><div><h2>Campaign details</h2></div></div>
          <dl className="detail-list">
            <div><dt>Status</dt><dd><StatusBadge status={report.status} /></dd></div>
            <div><dt>Budget</dt><dd>{formatCurrency(report.budget)}</dd></div>
            <div><dt>Minimum followers</dt><dd>{formatNumber(report.minFollowers)}</dd></div>
            <div><dt>Creator limit</dt><dd>{formatNumber(report.creatorLimit)}</dd></div>
            <div><dt>Dates</dt><dd>{formatDate(report.startDate)} – {formatDate(report.endDate)}</dd></div>
          </dl>
        </section>
        <section className="panel">
          <div className="panel-header"><div><h2>Payment and performance totals</h2><p>Metrics are values stored for campaign collaborations.</p></div></div>
          <dl className="money-list">
            <div><dt>Paid</dt><dd>{formatCurrency(report.payments.paidTotal)}</dd></div>
            <div><dt>Pending</dt><dd>{formatCurrency(report.payments.pendingTotal)}</dd></div>
            <div><dt>Views / likes</dt><dd>{formatNumber(report.performance.views)} / {formatNumber(report.performance.likes)}</dd></div>
            <div><dt>Comments / shares / clicks</dt><dd>{formatNumber(report.performance.comments)} / {formatNumber(report.performance.shares)} / {formatNumber(report.performance.clicks)}</dd></div>
          </dl>
        </section>
      </div>

      <div className="panel-grid">
        <StatusTable title="Applications" rows={report.applications} />
        <StatusTable title="Collaborations" rows={report.collaborations} />
      </div>
    </>
  );
}

function StatusTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ status: string; count: number }>;
}) {
  return (
    <section className="panel">
      <div className="panel-header"><div><h2>{title} by status</h2></div></div>
      {rows.length === 0 ? (
        <p className="empty-note">No {title.toLowerCase()} recorded.</p>
      ) : (
        <ul className="status-list">
          {rows.map((row) => (
            <li key={row.status}><StatusBadge status={row.status} /><strong>{formatNumber(row.count)}</strong></li>
          ))}
        </ul>
      )}
    </section>
  );
}
