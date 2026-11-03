import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { PlatformActivityPanel } from "@/components/dashboard/PlatformActivityPanel";
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
  const pendingDeliverables = statusValue(data.deliverables, "Pending");
  const awaitingReview = statusValue(data.submissions, "Pending");
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
          metricKey="brand.deliverables.pending"
          label="Pending deliverables"
          value={formatNumber(pendingDeliverables)}
          rawValue={pendingDeliverables}
          hint={`${awaitingReview} submissions awaiting review`}
          tone={awaitingReview > 0 ? "warning" : "default"}
        />
        <StatCard
          metricKey="brand.campaigns.budget"
          label="Sponsorship budget"
          value={formatCurrency(data.totalBudget)}
          rawValue={data.totalBudget}
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

      <PlatformActivityPanel />

      <div className="panel-grid">
        <section className="panel" aria-labelledby="delivery-heading">
          <div className="panel-header">
            <div>
              <h2 id="delivery-heading">Delivery progress</h2>
              <p>Deliverables and content submissions across your campaigns.</p>
            </div>
            <Link className="panel-link" href="/brand/deliverables">
              Review deliveries
            </Link>
          </div>
          {data.deliverables.total === 0 && data.submissions.total === 0 ? (
            <p className="empty-note">
              No delivery work is recorded yet. Accepted applications will appear here after deliverables are created.
            </p>
          ) : (
            <div className="split-lists">
              <div>
                <h3>Deliverables</h3>
                <ul className="status-list">
                  {Object.entries(data.deliverables.byStatus).map(([status, count]) => (
                    <li key={status}><StatusBadge status={status} /><strong>{formatNumber(count)}</strong></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Submissions</h3>
                <ul className="status-list">
                  {Object.entries(data.submissions.byStatus).map(([status, count]) => (
                    <li key={status}><StatusBadge status={status} /><strong>{formatNumber(count)}</strong></li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
        <section className="panel" aria-labelledby="performance-heading">
          <div className="panel-header">
            <div>
              <h2 id="performance-heading">Recorded campaign performance</h2>
              <p>Totals from metrics entered for your collaborations.</p>
            </div>
            <Link className="panel-link" href="/brand/collaborations">
              Collaborations
            </Link>
          </div>
          <dl className="money-list">
            <div><dt>Views</dt><dd>{formatNumber(data.performance.views)}</dd></div>
            <div><dt>Likes</dt><dd>{formatNumber(data.performance.likes)}</dd></div>
            <div><dt>Comments / shares / clicks</dt><dd>{formatNumber(data.performance.comments)} / {formatNumber(data.performance.shares)} / {formatNumber(data.performance.clicks)}</dd></div>
          </dl>
        </section>
      </div>

      <section className="panel" aria-labelledby="creators-heading">
        <div className="panel-header">
          <div>
            <h2 id="creators-heading">Creators by recorded views</h2>
            <p>Based on performance metrics associated with your collaborations.</p>
          </div>
          <Link className="panel-link" href="/brand/collaborations">
            View collaborations
          </Link>
        </div>
        {data.topCreators.length === 0 ? (
          <p className="empty-note">No collaboration performance metrics have been recorded yet.</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <caption className="sr-only">Creators ranked by recorded views</caption>
              <thead>
                <tr>
                  <th scope="col">Creator</th>
                  <th scope="col">Collaborations with metrics</th>
                  <th scope="col">Views</th>
                </tr>
              </thead>
              <tbody>
                {data.topCreators.map((creator) => (
                  <tr key={creator.creatorId}>
                    <td>{creator.creatorName}</td>
                    <td>{formatNumber(creator.collaborationCount)}</td>
                    <td>{formatNumber(creator.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
