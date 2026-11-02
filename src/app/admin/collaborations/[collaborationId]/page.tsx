import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getAdminCollaborationReport } from "@/lib/repositories/admin-directories";
import { financeIdParamSchema } from "@/lib/validations/finance";

export const metadata: Metadata = {
  title: "Admin collaboration detail",
};

type PageProps = { params: Promise<{ collaborationId: string }> };

export default async function AdminCollaborationDetailPage({ params }: PageProps) {
  await requireRole("Admin");
  const { collaborationId: rawId } = await params;
  const parsedId = financeIdParamSchema.safeParse(rawId);
  if (!parsedId.success) notFound();

  const collaboration = await getAdminCollaborationReport(parsedId.data);
  if (!collaboration) notFound();

  return (
    <>
      <PageHeader
        eyebrow={`${collaboration.creatorName} · ${collaboration.brandName}`}
        title={collaboration.campaignName}
        description="Read-only collaboration, delivery, payment, contract, and review summary."
        actions={<Link className="btn btn-secondary" href="/admin/collaborations">Back to collaborations</Link>}
      />
      <div className="panel-grid">
        <section className="panel">
          <div className="panel-header"><div><h2>Agreement</h2></div></div>
          <dl className="detail-list">
            <div><dt>Status</dt><dd><StatusBadge status={collaboration.status} /></dd></div>
            <div><dt>Agreed amount</dt><dd>{formatCurrency(collaboration.agreedAmount)}</dd></div>
            <div><dt>Dates</dt><dd>{formatDate(collaboration.startDate)} – {formatDate(collaboration.endDate)}</dd></div>
            <div><dt>Contract signed</dt><dd>{formatDate(collaboration.contract?.signedDate ?? null)}</dd></div>
            <div><dt>Contract expiry</dt><dd>{formatDate(collaboration.contract?.expiryDate ?? null)}</dd></div>
          </dl>
        </section>
        <section className="panel">
          <div className="panel-header"><div><h2>Performance metrics</h2></div></div>
          {collaboration.performance ? (
            <dl className="money-list">
              <div><dt>Views</dt><dd>{formatNumber(collaboration.performance.views)}</dd></div>
              <div><dt>Likes</dt><dd>{formatNumber(collaboration.performance.likes)}</dd></div>
              <div><dt>Comments / shares / clicks</dt><dd>{formatNumber(collaboration.performance.comments)} / {formatNumber(collaboration.performance.shares)} / {formatNumber(collaboration.performance.clicks)}</dd></div>
            </dl>
          ) : <p className="empty-note">No performance metrics recorded.</p>}
        </section>
      </div>
      <div className="panel-grid">
        <section className="panel">
          <div className="panel-header"><div><h2>Deliverables</h2></div></div>
          {collaboration.deliverables.length === 0 ? (
            <p className="empty-note">No deliverables recorded.</p>
          ) : (
            <ul className="status-list">
              {collaboration.deliverables.map((item) => (
                <li key={item.status}><StatusBadge status={item.status} /><strong>{formatNumber(item.count)}</strong></li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <div className="panel-header"><div><h2>Payments</h2></div></div>
          {collaboration.payments.length === 0 ? (
            <p className="empty-note">No payments recorded.</p>
          ) : (
            <ul className="status-list">
              {collaboration.payments.map((item) => (
                <li key={item.status}>
                  <StatusBadge status={item.status} />
                  <strong>{formatNumber(item.count)} · {formatCurrency(item.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-header"><div><h2>Review</h2></div></div>
        {collaboration.review ? (
          <>
            <p><strong>{collaboration.review.rating} / 5</strong> · {formatDate(collaboration.review.reviewDate)}</p>
            <p>{collaboration.review.feedback || "No written feedback."}</p>
            <p className="panel-note">The database does not record reviewer identity.</p>
          </>
        ) : <p className="empty-note">No review recorded.</p>}
      </section>
    </>
  );
}
