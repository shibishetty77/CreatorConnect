import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getAdminUserReport } from "@/lib/repositories/admin-directories";
import { financeIdParamSchema } from "@/lib/validations/finance";

export const metadata: Metadata = {
  title: "Admin user detail",
};

type PageProps = { params: Promise<{ userId: string }> };

export default async function AdminUserDetailPage({ params }: PageProps) {
  await requireRole("Admin");
  const { userId: rawId } = await params;
  const parsedId = financeIdParamSchema.safeParse(rawId);
  if (!parsedId.success) notFound();

  const user = await getAdminUserReport(parsedId.data);
  if (!user) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Read-only account detail"
        title={user.profileName ?? user.username}
        description={`@${user.username} · joined ${formatDate(user.createdAt)}`}
        actions={<Link className="btn btn-secondary" href="/admin/users">Back to users</Link>}
      />
      <div className="stats-grid">
        <StatCard metricKey="admin.user.campaigns" label="Campaigns" value={formatNumber(user.campaigns)} />
        <StatCard metricKey="admin.user.applications" label="Applications" value={formatNumber(user.applications)} />
        <StatCard metricKey="admin.user.collaborations" label="Collaborations" value={formatNumber(user.collaborations)} />
        <StatCard metricKey="admin.user.paid" label="Paid total" value={formatCurrency(user.paidTotal)} />
      </div>
      <section className="panel">
        <div className="panel-header"><div><h2>Account summary</h2></div></div>
        <dl className="detail-list">
          <div><dt>Role</dt><dd><StatusBadge status={user.role} /></dd></div>
          <div><dt>Account</dt><dd>{user.username}</dd></div>
          {user.profileName ? <div><dt>Profile</dt><dd>{user.profileName}</dd></div> : null}
          {user.industry ? <div><dt>Industry</dt><dd>{user.industry}</dd></div> : null}
          {user.location ? <div><dt>Location</dt><dd>{user.location}</dd></div> : null}
          {user.role === "Creator" ? (
            <>
              <div><dt>Social accounts</dt><dd>{formatNumber(user.socialAccounts)}</dd></div>
              <div><dt>Followers</dt><dd>{formatNumber(user.followers)}</dd></div>
            </>
          ) : null}
        </dl>
        <p className="panel-note">
          Passwords, email addresses, and direct contact details are not included in this report.
        </p>
      </section>
    </>
  );
}
