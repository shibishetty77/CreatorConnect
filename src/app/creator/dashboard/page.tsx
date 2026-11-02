import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { requireRole } from "@/lib/auth/guards";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { statusValue } from "@/lib/repositories/dashboard-types";
import { getCreatorDashboardData } from "@/lib/repositories/dashboard";

export const metadata: Metadata = {
  title: "Creator dashboard",
};

export default async function CreatorDashboardPage() {
  const user = await requireRole("Creator");

  if (!user.creatorProfile) {
    notFound();
  }

  const data = await getCreatorDashboardData(user.creatorProfile.creatorId);

  if (!data) {
    notFound();
  }

  const accepted = statusValue(data.applications, "Accepted");
  const rejected = statusValue(data.applications, "Rejected");
  const pendingApplications = statusValue(data.applications, "Pending");
  const activeCollaborations = statusValue(data.collaborations, "Active");
  const completedCollaborations = statusValue(
    data.collaborations,
    "Completed",
  );
  const pendingDeliverables = statusValue(
    data.deliverables,
    "Pending",
    "Submitted",
  );
  const completedDeliverables = statusValue(
    data.deliverables,
    "Completed",
    "Approved",
  );
  const totalFollowers = data.socialAccounts.reduce(
    (sum, account) => sum + account.followers,
    0,
  );
  const location = [data.profile.city, data.profile.state]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader
        eyebrow="Creator overview"
        title={`Welcome back, ${data.profile.firstName}.`}
        description="A live view of your campaign pipeline, deliverables, and earnings."
        actions={
          <Link className="btn btn-primary" href="/creator/campaigns">
            Discover campaigns
          </Link>
        }
      />

      <div className="stats-grid">
        <StatCard
          metricKey="creator.open-campaigns"
          label="Open campaigns"
          value={formatNumber(data.openCampaigns)}
          rawValue={data.openCampaigns}
          hint="Available to apply"
          tone="brand"
        />
        <StatCard
          metricKey="creator.applications.total"
          label="Applications"
          value={formatNumber(data.applications.total)}
          rawValue={data.applications.total}
          hint={`${pendingApplications} pending · ${accepted} accepted`}
        />
        <StatCard
          metricKey="creator.applications.accepted"
          label="Accepted"
          value={formatNumber(accepted)}
          rawValue={accepted}
          hint="Brand-approved applications"
          tone="success"
        />
        <StatCard
          metricKey="creator.applications.rejected"
          label="Rejected"
          value={formatNumber(rejected)}
          rawValue={rejected}
          hint="Applications not selected"
          tone={rejected > 0 ? "danger" : "default"}
        />
        <StatCard
          metricKey="creator.collaborations.active"
          label="Active collaborations"
          value={formatNumber(activeCollaborations)}
          rawValue={activeCollaborations}
          hint={`${completedCollaborations} completed`}
        />
        <StatCard
          metricKey="creator.collaborations.completed"
          label="Completed collaborations"
          value={formatNumber(completedCollaborations)}
          rawValue={completedCollaborations}
          hint="Delivered brand agreements"
          tone="success"
        />
        <StatCard
          metricKey="creator.deliverables.pending"
          label="Pending deliverables"
          value={formatNumber(pendingDeliverables)}
          rawValue={pendingDeliverables}
          hint={`${completedDeliverables} completed`}
          tone={pendingDeliverables > 0 ? "warning" : "default"}
        />
        <StatCard
          metricKey="creator.payments.paid"
          label="Paid to date"
          value={formatCurrency(data.payments.paidTotal)}
          rawValue={Number(data.payments.paidTotal)}
          hint={`${formatCurrency(data.payments.pendingTotal)} awaiting release`}
          tone="success"
        />
      </div>

      <div className="panel-grid">
        <section className="panel" aria-labelledby="activity-heading">
          <div className="panel-header">
            <div>
              <h2 id="activity-heading">Recent activity</h2>
              <p>Applications, collaborations, deliverables, and payments.</p>
            </div>
          </div>
          <ActivityFeed
            items={data.recentActivity}
            emptyMessage="Apply to a campaign to start building your activity feed."
          />
        </section>

        <section className="panel" aria-labelledby="payments-heading">
          <div className="panel-header">
            <div>
              <h2 id="payments-heading">Payment summary</h2>
              <p>Based on your current collaboration records.</p>
            </div>
            <Link className="panel-link" href="/creator/payments">
              View all
            </Link>
          </div>
          <dl className="money-list">
            <div>
              <dt>Paid</dt>
              <dd>{formatCurrency(data.payments.paidTotal)}</dd>
              <small>
                {statusValue(data.payments.count, "Paid")} payment records
              </small>
            </div>
            <div>
              <dt>Pending</dt>
              <dd>{formatCurrency(data.payments.pendingTotal)}</dd>
              <small>
                {statusValue(data.payments.count, "Pending")} awaiting release
              </small>
            </div>
            <div>
              <dt>Total agreed</dt>
              <dd>{formatCurrency(data.payments.agreedTotal)}</dd>
              <small>Across all collaborations</small>
            </div>
          </dl>
        </section>
      </div>

      <div className="panel-grid">
        <section className="panel" aria-labelledby="profile-heading">
          <div className="panel-header">
            <div>
              <h2 id="profile-heading">Profile snapshot</h2>
              <p>Keep your creator details current for brands.</p>
            </div>
            <Link className="panel-link" href="/creator/profile">
              Edit profile
            </Link>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Location</dt>
              <dd>{location || "Add your city and state"}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{data.profile.phone || "Add a contact number"}</dd>
            </div>
            <div>
              <dt>Account email</dt>
              <dd>{data.profile.email}</dd>
            </div>
            <div>
              <dt>Bio</dt>
              <dd>{data.profile.bio || "Add a short bio for brand teams."}</dd>
            </div>
          </dl>
        </section>

        <section className="panel" aria-labelledby="reach-heading">
          <div className="panel-header">
            <div>
              <h2 id="reach-heading">Social reach</h2>
              <p>
                {formatNumber(totalFollowers)} followers across{" "}
                {data.socialAccounts.length} accounts.
              </p>
            </div>
            <Link className="panel-link" href="/creator/profile#social-accounts">
              Manage
            </Link>
          </div>
          {data.socialAccounts.length === 0 ? (
            <p className="empty-note">
              Add a social account from your profile to show your reach.
            </p>
          ) : (
            <ul className="social-summary-list">
              {data.socialAccounts.map((account) => (
                <li key={account.accountId}>
                  <div>
                    <strong>{account.platform}</strong>
                    <span>@{account.username}</span>
                  </div>
                  <div>
                    <strong>{formatNumber(account.followers)}</strong>
                    <span>{formatPercent(account.engagementRate)} engagement</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
