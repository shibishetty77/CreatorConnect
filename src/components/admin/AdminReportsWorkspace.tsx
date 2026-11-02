"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  formatCurrency,
  formatNumber,
} from "@/lib/format";
import type { AdminReportOverview } from "@/lib/repositories/admin-reports";

type OverviewResponse = {
  data?: AdminReportOverview;
  error?: { message?: string };
};

function StatusSummary({
  title,
  entries,
}: {
  title: string;
  entries: Array<{ status: string; count: number }>;
}) {
  return (
    <section className="panel" aria-label={title}>
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="empty-note">No records yet.</p>
      ) : (
        <ul className="status-list">
          {entries.map((entry) => (
            <li key={entry.status}>
              <StatusBadge status={entry.status} />
              <strong>{formatNumber(entry.count)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminReportsWorkspace() {
  const [report, setReport] = useState<AdminReportOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadReport() {
      try {
        const response = await fetch("/api/admin/reports/overview", {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as OverviewResponse;
        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message ?? "The report could not be loaded.");
        }
        setReport(payload.data);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The report could not be loaded.",
          );
        }
      }
    }

    void loadReport();
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <section className="panel error-panel" role="alert">
        <h2>Reports could not be loaded</h2>
        <p>{error}</p>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            setError("");
            setReport(null);
            window.location.reload();
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  if (!report) {
    return (
      <div className="dashboard-loading" role="status" aria-busy="true">
        <span className="sr-only">Loading reports</span>
        <div className="skeleton skeleton-heading" />
        <div className="stats-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="skeleton skeleton-card" key={index} />
          ))}
        </div>
        <div className="skeleton skeleton-panel" />
      </div>
    );
  }

  const t = report.totals;
  const noData = t.users + t.campaigns + t.applications + t.collaborations === 0;

  return (
    <>
      {noData ? (
        <p className="empty-note" role="status">
          No data in the platform yet. Reports will populate as users create campaigns.
        </p>
      ) : null}
      <div className="stats-grid stats-grid-wide">
        <ReportStat label="Users" value={formatNumber(t.users)} />
        <ReportStat label="Creators" value={formatNumber(t.creators)} />
        <ReportStat label="Brands" value={formatNumber(t.brands)} />
        <ReportStat label="Campaigns" value={formatNumber(t.campaigns)} />
        <ReportStat label="Applications" value={formatNumber(t.applications)} />
        <ReportStat label="Collaborations" value={formatNumber(t.collaborations)} />
        <ReportStat label="Payments" value={formatNumber(t.payments)} />
        <ReportStat label="Reviews" value={formatNumber(t.reviews)} />
      </div>

      <div className="panel-grid">
        <StatusSummary title="Campaign status" entries={report.statuses.campaigns} />
        <StatusSummary title="Application status" entries={report.statuses.applications} />
      </div>
      <div className="panel-grid">
        <StatusSummary title="Collaboration status" entries={report.statuses.collaborations} />
        <StatusSummary title="Payment status" entries={report.statuses.payments} />
      </div>
      <div className="panel-grid">
        <StatusSummary title="Deliverable status" entries={report.statuses.deliverables} />
        <StatusSummary title="Submission status" entries={report.statuses.submissions} />
      </div>

      <div className="panel-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Stored financial and review totals</h2>
              <p>Payment DECIMAL totals and ratings recorded in the database.</p>
            </div>
          </div>
          <dl className="money-list">
            <div><dt>Paid</dt><dd>{formatCurrency(t.paidTotal)}</dd></div>
            <div><dt>Pending</dt><dd>{formatCurrency(t.pendingTotal)}</dd></div>
            <div>
              <dt>Average rating</dt>
              <dd>{t.averageRating === null ? "Unavailable" : `${Number(t.averageRating).toFixed(2)} / 5`}</dd>
              <small>{formatNumber(t.reviewCount)} reviews</small>
            </div>
          </dl>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Recorded performance</h2>
              <p>Sum of metrics rows; these are not independently verified reach.</p>
            </div>
          </div>
          <dl className="money-list">
            <div><dt>Views</dt><dd>{formatNumber(t.views)}</dd></div>
            <div><dt>Likes</dt><dd>{formatNumber(t.likes)}</dd></div>
            <div><dt>Comments / shares / clicks</dt><dd>{formatNumber(t.comments)} / {formatNumber(t.shares)} / {formatNumber(t.clicks)}</dd></div>
          </dl>
        </section>
      </div>

      <div className="panel-grid">
        <ReportTable
          title="Campaigns by category"
          headers={["Category", "Campaigns", "Budget"]}
          empty="No categories or campaigns found."
          rows={report.categories.map((row) => [
            row.categoryName,
            formatNumber(row.campaignCount),
            formatCurrency(row.totalBudget),
          ])}
        />
        <ReportTable
          title="Campaign requirements by platform"
          headers={["Platform", "Campaigns", "Requirements"]}
          empty="No platform requirements recorded."
          rows={report.platforms.map((row) => [
            row.platform,
            formatNumber(row.campaignCount),
            formatNumber(row.requirementCount),
          ])}
        />
      </div>

      <div className="panel-grid">
        <ReportTable
          title="Monthly payment activity"
          headers={["Month", "Records", "Paid amount"]}
          empty="No dated payments in the last six months."
          rows={report.monthlyPayments.map((row) => [
            row.month,
            formatNumber(row.count),
            formatCurrency(row.total),
          ])}
        />
        <ReportTable
          title="Monthly applications"
          headers={["Month", "Applications"]}
          empty="No applications in the last six months."
          rows={report.monthlyApplications.map((row) => [
            row.month,
            formatNumber(row.count),
          ])}
        />
      </div>

      <div className="panel-grid">
        <ReportTable
          title="Creator activity"
          headers={["Creator", "Completed", "Views", "Rating"]}
          empty="No creator collaboration data yet."
          rows={report.topCreators.map((row) => [
            row.creatorName,
            formatNumber(row.completedCount),
            formatNumber(row.views),
            row.averageRating === null
              ? "No reviews"
              : `${Number(row.averageRating).toFixed(2)} (${row.reviewCount})`,
          ])}
        />
        <ReportTable
          title="Brand activity"
          headers={["Brand", "Campaigns", "Collaborations", "Paid"]}
          empty="No brand data yet."
          rows={report.topBrands.map((row) => [
            row.brandName,
            formatNumber(row.campaignCount),
            formatNumber(row.collaborationCount),
            formatCurrency(row.paidTotal),
          ])}
        />
      </div>

      <ReportTable
        title="Campaign summaries"
        headers={["Campaign", "Brand / category", "Applications", "Collaborations", "Status", "Report"]}
        empty="No campaigns found."
        rows={report.campaigns.map((row) => [
          row.campaignName,
          `${row.brandName}${row.categoryName ? ` · ${row.categoryName}` : ""}`,
          formatNumber(row.applicationCount),
          formatNumber(row.collaborationCount),
          row.status,
          <Link className="panel-link" href={`/admin/campaigns/${row.campaignId}`} key={`report-${row.campaignId}`}>
            View report
          </Link>,
        ])}
      />
    </>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
    </div>
  );
}

function ReportTable({
  title,
  headers,
  rows,
  empty,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string | ReactNode>>;
  empty: string;
}) {
  return (
    <section className="panel">
      <div className="panel-header"><div><h2>{title}</h2></div></div>
      {rows.length === 0 ? (
        <p className="empty-note">{empty}</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
