import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignApplyButton } from "@/components/campaigns/CampaignApplyButton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { getCreatorCampaignById } from "@/lib/repositories/campaign-discovery";
import { campaignIdParamSchema } from "@/lib/validations/campaigns";

export const metadata: Metadata = {
  title: "Campaign details",
};

type CampaignDetailPageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function CreatorCampaignDetailPage({
  params,
}: CampaignDetailPageProps) {
  const user = await requireRole("Creator");

  if (!user.creatorProfile) {
    notFound();
  }

  const { campaignId: rawId } = await params;
  const parsedId = campaignIdParamSchema.safeParse(rawId);

  if (!parsedId.success) {
    notFound();
  }

  const campaign = await getCreatorCampaignById(
    user.creatorProfile.creatorId,
    parsedId.data,
  );

  if (!campaign) {
    notFound();
  }

  const hasApplied = campaign.applicationStatus !== null;
  const applicationsClosed =
    campaign.status !== "Open" || !campaign.applicationWindowOpen;
  const isFull = campaign.remainingSlots <= 0;
  const canApply = campaign.eligible && !applicationsClosed && !isFull;
  const disabledLabel = applicationsClosed
    ? "Applications closed"
    : isFull
      ? "Campaign full"
      : !campaign.eligible
        ? "Not eligible"
        : "Apply to campaign";

  return (
    <>
      <PageHeader
        eyebrow={campaign.categoryName ?? "Campaign"}
        title={campaign.campaignName}
        description={`Offered by ${campaign.brandName}. Review the brief, requirements and deadlines before applying.`}
        actions={
          <Link className="btn btn-secondary" href="/creator/campaigns">
            Back to discovery
          </Link>
        }
      />

      <div className="panel-grid">
        <section className="panel" aria-labelledby="campaign-overview-heading">
          <div className="panel-header">
            <div>
              <h2 id="campaign-overview-heading">Campaign overview</h2>
              <p>Confirmed details from the brand campaign record.</p>
            </div>
            <div className="status-stack">
              <StatusBadge status={campaign.status} />
              {campaign.applicationStatus ? (
                <StatusBadge status={campaign.applicationStatus} />
              ) : null}
            </div>
          </div>

          {campaign.description ? <p>{campaign.description}</p> : null}

          <dl className="campaign-facts">
            <div>
              <dt>Brand</dt>
              <dd>{campaign.brandName}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{campaign.categoryName ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Campaign budget</dt>
              <dd>{formatCurrency(campaign.budget)}</dd>
            </div>
            <div>
              <dt>Campaign dates</dt>
              <dd>
                {formatDate(campaign.startDate)} to{" "}
                {formatDate(campaign.endDate)}
              </dd>
            </div>
            <div>
              <dt>Minimum followers per account</dt>
              <dd>{formatNumber(campaign.minFollowers)}</dd>
            </div>
            <div>
              <dt>Creator slots</dt>
              <dd>
                {formatNumber(campaign.acceptedApplications)} of{" "}
                {formatNumber(campaign.creatorLimit)} filled
              </dd>
            </div>
            <div>
              <dt>Application window</dt>
              <dd>
                {campaign.applicationWindowOpen
                  ? "Open for applications"
                  : "Closed"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel form-stack" aria-labelledby="campaign-action-heading">
          <h2 id="campaign-action-heading">Your application</h2>

          {hasApplied ? (
            <>
              <p>
                You have already applied to this campaign. Current status:{" "}
                <StatusBadge status={campaign.applicationStatus as string} />
              </p>
              <Link className="btn btn-secondary" href="/creator/applications">
                View my applications
              </Link>
            </>
          ) : (
            <>
              {campaign.eligible ? (
                <p className="form-success" role="status">
                  Your social accounts meet this campaign&apos;s requirements.
                </p>
              ) : (
                <ul className="form-error" aria-label="Eligibility requirements">
                  {campaign.eligibilityReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              {applicationsClosed ? (
                <p className="form-error" role="status">
                  This campaign is no longer accepting applications.
                </p>
              ) : null}
              {isFull ? (
                <p className="form-error" role="status">
                  This campaign has reached its creator limit.
                </p>
              ) : null}
              <CampaignApplyButton
                campaignId={campaign.campaignId}
                canApply={canApply}
                disabledLabel={disabledLabel}
              />
            </>
          )}

          <p className="field-hint">
            Applications are reviewed by the brand. If accepted, a collaboration
            and deliverable schedule are created for you.
          </p>
        </section>

        <section className="panel" aria-labelledby="campaign-requirements-heading">
          <div className="panel-header">
            <div>
              <h2 id="campaign-requirements-heading">
                Required platforms and eligibility
              </h2>
              <p>
                Each requirement must be met by at least one of your social
                accounts.
              </p>
            </div>
          </div>

          {campaign.requirements.length === 0 ? (
            <p className="empty-note">
              This campaign has no platform-specific requirements. You still
              need an account meeting the follower threshold.
            </p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <caption className="sr-only">
                  Requirements for {campaign.campaignName}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Platform</th>
                    <th scope="col">Minimum engagement</th>
                    <th scope="col">Required niche</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.requirements.map((requirement) => (
                    <tr key={requirement.requirementId}>
                      <td>
                        <strong>{requirement.platform ?? "Any platform"}</strong>
                      </td>
                      <td>
                        {requirement.minEngagementRate === null
                          ? "Not specified"
                          : formatPercent(requirement.minEngagementRate)}
                      </td>
                      <td>{requirement.requiredNiche ?? "Not specified"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="field-hint">
            Deliverable titles and descriptions are defined by the brand after a
            collaboration is created. The schema stores content type, due date
            and submission status.
          </p>
        </section>
      </div>
    </>
  );
}
