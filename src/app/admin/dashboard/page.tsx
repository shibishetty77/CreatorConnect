import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/lib/format";
import { statusValue } from "@/lib/repositories/dashboard-types";
import { getAdminDashboardData } from "@/lib/repositories/dashboard";

export const metadata: Metadata = {
  title: "Admin dashboard",
};

export default async function AdminDashboardPage() {
  await requireRole("Admin");

  const data = await getAdminDashboardData();
  const roleEntries = Object.entries(data.roleCounts.byStatus).sort(
    (a, b) => b[1] - a[1],
  );
  const campaignEntries = Object.entries(data.campaignStatuses.byStatus).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <>
      <PageHeader
        eyebrow="Platform overview"
        title="Administrator dashboard"
        description="Live summaries of platform activity, stored performance, and financial records."
        actions={
          <Link className="btn btn-primary" href="/admin/reports">
            Open reports
          </Link>
        }
      />

      <div className="stats-grid stats-grid-wide">
        <StatCard
          metricKey="admin.users.total"
          label="Users"
          value={formatNumber(data.counts.users)}
          rawValue={data.counts.users}
          hint="All platform accounts"
          tone="brand"
        />
        <StatCard
          metricKey="admin.creators.total"
          label="Creators"
          value={formatNumber(data.counts.creators)}
          rawValue={data.counts.creators}
          hint="Creator profiles"
        />
        <StatCard
          metricKey="admin.brands.total"
          label="Brands"
          value={formatNumber(data.counts.brands)}
          rawValue={data.counts.brands}
          hint="Brand profiles"
        />
        <StatCard
          metricKey="admin.campaigns.total"
          label="Campaigns"
          value={formatNumber(data.counts.campaigns)}
          rawValue={data.counts.campaigns}
          hint={`${statusValue(data.campaignStatuses, "Open")} open`}
        />
        <StatCard
          metricKey="admin.collaborations.total"
          label="Collaborations"
          value={formatNumber(data.counts.collaborations)}
          rawValue={data.counts.collaborations}
          hint="All collaboration records"
        />
        <StatCard
          metricKey="admin.collaborations.completed"
          label="Completed"
          value={formatNumber(data.counts.completedCollaborations)}
          rawValue={data.counts.completedCollaborations}
          hint="Successfully delivered"
          tone="success"
        />
        <StatCard
          metricKey="admin.payments.total"
          label="Payment records"
          value={formatNumber(data.counts.payments)}
          rawValue={data.counts.payments}
          hint={`${data.counts.paidCount} marked paid`}
        />
        <StatCard
          metricKey="admin.activity.total"
          label="Platform activity"
          value={formatNumber(data.counts.totalActivity)}
          rawValue={data.counts.totalActivity}
          hint="Applications, submissions, reviews, collaborations"
        />
        <StatCard
          metricKey="admin.reviews.average"
          label="Average rating"
          value={
            data.counts.averageRating === null
              ? "—"
              : `${Number(data.counts.averageRating).toFixed(2)} / 5`
          }
          hint={`${formatNumber(data.counts.reviews)} reviews`}
        />
      </div>

      <div className="panel-grid">
        <section className="panel" aria-labelledby="mix-heading">
          <div className="panel-header">
            <div>
              <h2 id="mix-heading">Platform mix</h2>
              <p>Account roles and campaign status distribution.</p>
            </div>
          </div>
          <div className="split-lists">
            <div>
              <h3>Accounts by role</h3>
              {roleEntries.length === 0 ? (
                <p className="empty-note">No accounts have been created.</p>
              ) : (
                <ul className="status-list">
                  {roleEntries.map(([role, count]) => (
                    <li key={role}>
                      <StatusBadge status={role} />
                      <strong>{formatNumber(count)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>Campaigns by status</h3>
              {campaignEntries.length === 0 ? (
                <p className="empty-note">No campaigns found.</p>
              ) : (
                <ul className="status-list">
                  {campaignEntries.map(([status, count]) => (
                    <li key={status}>
                      <StatusBadge status={status} />
                      <strong>{formatNumber(count)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="panel" aria-labelledby="oversight-heading">
          <div className="panel-header">
            <div>
              <h2 id="oversight-heading">Payment oversight</h2>
              <p>Released value and platform activity totals.</p>
            </div>
          </div>
          <dl className="money-list">
            <div>
              <dt>Total paid</dt>
              <dd>{formatCurrency(data.paidTotal)}</dd>
              <small>Across all paid payment records</small>
            </div>
            <div>
              <dt>Paid records</dt>
              <dd>{formatNumber(data.counts.paidCount)}</dd>
              <small>Out of {formatNumber(data.counts.payments)} payments</small>
            </div>
            <div>
              <dt>Applications</dt>
              <dd>{formatNumber(data.counts.applications)}</dd>
              <small>
                {formatNumber(data.counts.submissions)} submissions ·{" "}
                {formatNumber(data.counts.reviews)} reviews
              </small>
            </div>
          </dl>
          <p className="panel-note">
            Payment status changes may complete collaborations through the verified database triggers.
          </p>
        </section>
      </div>

      <div className="panel-grid">
        <StatusBreakdown title="Applications by status" entries={data.applicationStatuses.byStatus} />
        <StatusBreakdown title="Collaborations by status" entries={data.collaborationStatuses.byStatus} />
      </div>
      <StatusBreakdown title="Payments by status" entries={data.paymentStatuses.byStatus} />

      <div className="panel-grid">
        <section className="panel" aria-labelledby="users-heading">
          <div className="panel-header">
            <div>
              <h2 id="users-heading">Recent users</h2>
              <p>Newest accounts across every role.</p>
            </div>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <caption className="sr-only">Recent users</caption>
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.recentUsers.length === 0 ? (
                  <tr><td colSpan={3}>No users found.</td></tr>
                ) : data.recentUsers.map((account) => (
                  <tr key={account.userId}>
                    <td><strong>{account.username}</strong></td>
                    <td>
                      <StatusBadge status={account.role} />
                    </td>
                    <td>{formatDate(account.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="campaigns-heading">
          <div className="panel-header">
            <div>
              <h2 id="campaigns-heading">Recent campaigns</h2>
              <p>Latest campaigns by start date.</p>
            </div>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <caption className="sr-only">Recent campaigns</caption>
              <thead>
                <tr>
                  <th scope="col">Campaign</th>
                  <th scope="col">Budget</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCampaigns.length === 0 ? (
                  <tr><td colSpan={3}>No campaigns found.</td></tr>
                ) : data.recentCampaigns.map((campaign) => (
                  <tr key={campaign.campaignId}>
                    <td>
                      <Link href={`/admin/campaigns/${campaign.campaignId}`}>
                        <strong>{campaign.campaignName}</strong>
                      </Link>
                      <span className="table-subtext">
                        {campaign.brandName} · {formatDate(campaign.startDate)}
                      </span>
                    </td>
                    <td>{formatCurrency(campaign.budget)}</td>
                    <td>
                      <StatusBadge status={campaign.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel" aria-labelledby="collaborations-heading">
        <div className="panel-header">
          <div>
            <h2 id="collaborations-heading">Recent collaborations</h2>
            <p>Newest creator-brand agreements on the platform.</p>
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <caption className="sr-only">Recent collaborations</caption>
            <thead>
              <tr>
                <th scope="col">Creator</th>
                <th scope="col">Campaign</th>
                <th scope="col">Agreed amount</th>
                <th scope="col">Started</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentCollaborations.length === 0 ? (
                <tr><td colSpan={5}>No collaborations found.</td></tr>
              ) : data.recentCollaborations.map((collaboration) => (
                <tr key={collaboration.collaborationId}>
                  <td>{collaboration.creatorName}</td>
                  <td>
                    <strong>{collaboration.campaignName}</strong>
                    <span className="table-subtext">
                      {collaboration.brandName}
                    </span>
                  </td>
                  <td>{formatCurrency(collaboration.agreedAmount)}</td>
                  <td>{formatDate(collaboration.startDate)}</td>
                  <td>
                    <StatusBadge status={collaboration.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function StatusBreakdown({
  title,
  entries,
}: {
  title: string;
  entries: Record<string, number>;
}) {
  const rows = Object.entries(entries).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(rows[0]?.[1] ?? 0, 1);
  return (
    <section className="panel" aria-label={title}>
      <div className="panel-header"><div><h2>{title}</h2></div></div>
      {rows.length === 0 ? (
        <p className="empty-note">No records found.</p>
      ) : (
        <ul className="breakdown-list">
          {rows.map(([status, count]) => (
            <li key={status}>
              <StatusBadge status={status} />
              <strong>{formatNumber(count)}</strong>
              <span className="breakdown-meter" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.round((count / maxCount) * 100)}%`,
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
