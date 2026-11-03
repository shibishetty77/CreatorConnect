import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApplicationWithdrawButton } from "@/components/applications/ApplicationWithdrawButton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCreatorApplicationById } from "@/lib/repositories/applications";
import { applicationIdParamSchema } from "@/lib/validations/applications";

export const metadata: Metadata = {
  title: "Application details",
};

type ApplicationDetailPageProps = {
  params: Promise<{ applicationId: string }>;
};

export default async function CreatorApplicationDetailPage({
  params,
}: ApplicationDetailPageProps) {
  const user = await requireRole("Creator");

  if (!user.creatorProfile) {
    notFound();
  }

  const { applicationId: rawId } = await params;
  const parsedId = applicationIdParamSchema.safeParse(rawId);

  if (!parsedId.success) {
    notFound();
  }

  const application = await getCreatorApplicationById(
    user.creatorProfile.creatorId,
    parsedId.data,
  );

  if (!application) {
    notFound();
  }

  const canWithdraw =
    application.status === "Pending" && application.collaborationId === null;

  return (
    <>
      <PageHeader
        eyebrow="Application details"
        title={application.campaignName}
        description={`Application to ${application.brandName}. Review the campaign context and your current status.`}
        actions={
          <Link className="btn btn-secondary" href="/creator/applications">
            Back to applications
          </Link>
        }
      />

      <div className="panel-grid">
        <section className="panel" aria-labelledby="application-status-heading">
          <div className="panel-header">
            <div>
              <h2 id="application-status-heading">Application status</h2>
              <p>Submitted on {formatDate(application.appliedDate)}.</p>
            </div>
            <StatusBadge status={application.status} />
          </div>

          <dl className="campaign-facts">
            <div>
              <dt>Campaign status</dt>
              <dd>
                <StatusBadge status={application.campaignStatus} />
              </dd>
            </div>
            <div>
              <dt>Brand</dt>
              <dd>{application.brandName}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{application.categoryName ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Campaign budget</dt>
              <dd>{formatCurrency(application.budget)}</dd>
            </div>
            <div>
              <dt>Campaign start</dt>
              <dd>{formatDate(application.startDate)}</dd>
            </div>
            <div>
              <dt>Campaign end</dt>
              <dd>{formatDate(application.endDate)}</dd>
            </div>
          </dl>

          {application.campaignDescription ? (
            <>
              <h3>Campaign description</h3>
              <p>{application.campaignDescription}</p>
            </>
          ) : null}
        </section>

        <section className="panel form-stack" aria-labelledby="application-actions-heading">
          <h2 id="application-actions-heading">Actions</h2>

          {application.status === "Pending" ? (
            <p>
              The brand has not reviewed this application yet. You can withdraw
              it while it is still pending.
            </p>
          ) : application.status === "Accepted" ? (
            <p>
              This application was accepted. Open your collaboration to review
              deliverables and deadlines.
            </p>
          ) : (
            <p>
              This application was rejected. You can still browse other open
              campaigns.
            </p>
          )}

          <div className="page-actions">
            <Link
              className="btn btn-secondary"
              href={`/creator/campaigns/${application.campaignId}`}
            >
              View campaign
            </Link>
            {application.collaborationId !== null ? (
              <Link
                className="btn btn-primary"
                href={`/creator/collaborations/${application.collaborationId}`}
              >
                Open collaboration
              </Link>
            ) : null}
          </div>

          {canWithdraw ? (
            <ApplicationWithdrawButton
              applicationId={application.applicationId}
              campaignName={application.campaignName}
              small={false}
            />
          ) : null}

          {application.status === "Pending" &&
          application.collaborationId !== null ? (
            <p className="field-hint">
              A collaboration exists for this application, so it can no longer
              be withdrawn.
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
