import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import { formatCurrency, formatNumber } from "@/lib/format";
import { statusValue } from "@/lib/repositories/dashboard-types";
import { getBrandDashboardData } from "@/lib/repositories/dashboard";

export const metadata: Metadata = {
  title: "Brand dashboard",
};

export default async function BrandDashboardPage() {
  const user = await requireRole("Brand");

  if (!user.brandProfile) {
    notFound();
  }

  const data = await getBrandDashboardData(user.brandProfile.brandId);

  if (!data) {
    notFound();
  }

  const openCampaigns = statusValue(data.campaigns, "Open");
  const ongoingCampaigns = statusValue(data.campaigns, "Ongoing");
  const completedCampaigns = statusValue(data.campaigns, "Completed");
  const pendingApplications = statusValue(data.applications, "Pending");
  const acceptedApplications = statusValue(data.applications, "Accepted");
  const activeCollaborations = statusValue(data.collaborations, "Active");
  const completedCollaborations = statusValue(
    data.collaborations,
    "Completed",
  );
  const location = [data.profile.city, data.profile.state]
    .filter(Boolean)
    .join(", ");
  const campaignStatuses = Object.entries(data.campaigns.byStatus).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <>
      <PageHeader
        eyebrow="Brand overview"
        title={`Welcome back, ${data.profile.brandName}.`}
        description="Track campaign performance, creator applications, and sponsorship spend."
        actions={
          <Link className="btn btn-primary" href="/brand/campaigns/new">
            Create campaign
          </Link>
        }
      />

      <div className="stats-grid">
        <StatCard
          metricKey="brand.campaigns.total"
          label="Total campaigns"
          value={formatNumber(data.campaigns.total)}
          rawValue={data.campaigns.total}
          hint={`${openCampaigns} open · ${ongoingCampaigns} ongoing`}
          tone="brand"
        />
        <StatCard
          metricKey="brand.campaigns.open"
          label="Open campaigns"
          value={formatNumber(openCampaigns)}
          rawValue={openCampaigns}
          hint="Accepting creator applications"
        />
        <StatCard
          metricKey="brand.campaigns.ongoing"
          label="Ongoing campaigns"
          value={formatNumber(ongoingCampaigns)}
          rawValue={ongoingCampaigns}
          hint="Currently in delivery"
        />
        <StatCard
          metricKey="brand.campaigns.completed"
          label="Completed campaigns"
          value={formatNumber(completedCampaigns)}
          rawValue={completedCampaigns}
          hint="Finished campaigns"
          tone="success"
        />
        <StatCard
          metricKey="brand.applications.total"
          label="Applications received"
          value={formatNumber(data.applications.total)}
          rawValue={data.applications.total}
          hint={`${pendingApplications} pending · ${acceptedApplications} accepted`}
        />
        <StatCard
          metricKey="brand.applications.pending"
          label="Pending applications"
          value={formatNumber(pendingApplications)}
          rawValue={pendingApplications}
          hint="Awaiting review"
          tone={pendingApplications > 0 ? "warning" : "default"}
        />
        <StatCard
          metricKey="brand.collaborations.active"
          label="Active collaborations"
          value={formatNumber(activeCollaborations)}
          rawValue={activeCollaborations}
          hint={`${completedCollaborations} completed`}
        />
        <StatCard
          metricKey="brand.campaigns.budget"
          label="Sponsorship budget"
          value={formatCurrency(data.totalBudget)}
          rawValue={Number(data.totalBudget)}
          hint="Across all campaigns"
        />
      </div>

      <div className="panel-grid">
        <section className="panel" aria-labelledby="activity-heading">
          <div className="panel-header">
            <div>
              <h2 id="activity-heading">Recent activity</h2>
              <p>
                Campaign launches, applications, deliverables, and payments.
              </p>
            </div>
          </div>
          <ActivityFeed
            items={data.recentActivity}
            emptyMessage="Create a campaign to start tracking brand activity."
          />
        </section>

        <section className="panel" aria-labelledby="payments-heading">
          <div className="panel-header">
            <div>
              <h2 id="payments-heading">Payment summary</h2>
              <p>Committed and released creator payments.</p>
            </div>
            <Link className="panel-link" href="/brand/payments">
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
              <dt>Total campaign budget</dt>
              <dd>{formatCurrency(data.totalBudget)}</dd>
              <small>{data.campaigns.total} campaigns on record</small>
            </div>
          </dl>
        </section>
      </div>

      <div className="panel-grid">
        <section className="panel" aria-labelledby="campaign-mix-heading">
          <div className="panel-header">
            <div>
              <h2 id="campaign-mix-heading">Campaign mix</h2>
              <p>Portfolio split by campaign status.</p>
            </div>
            <Link className="panel-link" href="/brand/campaigns">
              View campaigns
            </Link>
          </div>
          {campaignStatuses.length === 0 ? (
            <p className="empty-note">No campaigns have been created yet.</p>
          ) : (
            <ul className="status-list">
              {campaignStatuses.map(([status, count]) => (
                <li key={status}>
                  <StatusBadge status={status} />
                  <strong>{formatNumber(count)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="profile-heading">
          <div className="panel-header">
            <div>
              <h2 id="profile-heading">Brand profile</h2>
              <p>The details creators see when reviewing campaigns.</p>
            </div>
            <Link className="panel-link" href="/brand/profile">
              Edit profile
            </Link>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Industry</dt>
              <dd>{data.profile.industry || "Add your industry"}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{location || "Add your city and state"}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{data.profile.contactNumber || "Add a contact number"}</dd>
            </div>
            <div>
              <dt>Account email</dt>
              <dd>{data.profile.email}</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
