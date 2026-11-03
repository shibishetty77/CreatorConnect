import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApplicationWithdrawButton } from "@/components/applications/ApplicationWithdrawButton";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { listCreatorApplications } from "@/lib/repositories/applications";
import { creatorApplicationQuerySchema } from "@/lib/validations/applications";

export const metadata: Metadata = {
  title: "My applications",
};

type CreatorApplicationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function buildPageHref(
  query: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }

  params.set("page", String(page));

  return `/creator/applications?${params}`;
}

export default async function CreatorApplicationsPage({
  searchParams,
}: CreatorApplicationsPageProps) {
  const user = await requireRole("Creator");

  if (!user.creatorProfile) {
    notFound();
  }

  const rawSearchParams = await searchParams;
  const rawQuery = Object.fromEntries(
    Object.entries(rawSearchParams)
      .map(([key, value]) => [key, getSingleValue(value)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const parsedQuery = creatorApplicationQuerySchema.safeParse(rawQuery);
  const filters = parsedQuery.success
    ? parsedQuery.data
    : creatorApplicationQuerySchema.parse({});
  const page = await listCreatorApplications(
    user.creatorProfile.creatorId,
    filters,
  );

  const currentQuery = {
    q: filters.q || undefined,
    status: filters.status !== "all" ? filters.status : undefined,
  };

  return (
    <>
      <PageHeader
        eyebrow="Application pipeline"
        title="My applications"
        description="Review every application you have submitted and where it stands."
        actions={
          <Link className="btn btn-primary" href="/creator/campaigns">
            Discover campaigns
          </Link>
        }
      />

      <section className="panel filter-summary" aria-label="Application totals">
        <span>Total: {formatNumber(page.total)}</span>
        <span>Pending: {formatNumber(page.statusCounts.Pending)}</span>
        <span>Accepted: {formatNumber(page.statusCounts.Accepted)}</span>
        <span>Rejected: {formatNumber(page.statusCounts.Rejected)}</span>
      </section>

      <form className="panel admin-filter-form" method="get">
        <label className="field">
          <span className="field-label">Search</span>
          <input
            name="q"
            maxLength={120}
            defaultValue={filters.q ?? ""}
            placeholder="Campaign or brand name"
          />
        </label>
        <label className="field">
          <span className="field-label">Status</span>
          <select name="status" defaultValue={filters.status}>
            <option value="all">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Rows per page</span>
          <select name="pageSize" defaultValue={String(filters.pageSize)}>
            <option value="8">8</option>
            <option value="16">16</option>
            <option value="32">32</option>
          </select>
        </label>
        <div className="page-actions">
          <button className="btn btn-primary" type="submit">
            Apply filters
          </button>
          <Link className="btn btn-secondary" href="/creator/applications">
            Clear
          </Link>
        </div>
      </form>

      <section className="panel">
        {page.applications.length === 0 ? (
          <p className="empty-note">
            {filters.q || filters.status !== "all"
              ? "No applications match these filters."
              : "You have not submitted any campaign applications yet."}
          </p>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <caption className="sr-only">Your campaign applications</caption>
                <thead>
                  <tr>
                    <th scope="col">Campaign</th>
                    <th scope="col">Brand</th>
                    <th scope="col">Applied</th>
                    <th scope="col">Campaign dates</th>
                    <th scope="col">Budget</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {page.applications.map((application) => (
                    <tr key={application.applicationId}>
                      <td>
                        <Link
                          href={`/creator/applications/${application.applicationId}`}
                        >
                          {application.campaignName}
                        </Link>
                        {application.categoryName ? (
                          <span className="table-note">
                            {application.categoryName}
                          </span>
                        ) : null}
                      </td>
                      <td>{application.brandName}</td>
                      <td>{formatDate(application.appliedDate)}</td>
                      <td>
                        {formatDate(application.startDate)} to{" "}
                        {formatDate(application.endDate)}
                      </td>
                      <td>{formatCurrency(application.budget)}</td>
                      <td>
                        <StatusBadge status={application.status} />
                      </td>
                      <td>
                        <div className="table-actions">
                          <Link
                            className="btn btn-secondary btn-small"
                            href={`/creator/applications/${application.applicationId}`}
                          >
                            View
                          </Link>
                          {application.status === "Pending" &&
                          application.collaborationId === null ? (
                            <ApplicationWithdrawButton
                              applicationId={application.applicationId}
                              campaignName={application.campaignName}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <nav className="pagination" aria-label="Application pages">
              {page.page > 1 ? (
                <Link
                  className="btn btn-secondary"
                  href={buildPageHref(currentQuery, page.page - 1)}
                >
                  Previous
                </Link>
              ) : (
                <span className="btn btn-secondary btn-disabled">Previous</span>
              )}
              <span>
                Page {formatNumber(page.page)} of{" "}
                {formatNumber(page.totalPages)}
              </span>
              {page.page < page.totalPages ? (
                <Link
                  className="btn btn-secondary"
                  href={buildPageHref(currentQuery, page.page + 1)}
                >
                  Next
                </Link>
              ) : (
                <span className="btn btn-secondary btn-disabled">Next</span>
              )}
            </nav>
          </>
        )}
      </section>
    </>
  );
}
