"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { WorkspaceEmptyState } from "@/components/dashboard/WorkspaceEmptyState";
import { formatDate, formatNumber } from "@/lib/format";
import type { BrandApplicationRecord } from "@/lib/repositories/brand-applications";

type ApplicationsResponse = {
  data?: { applications: BrandApplicationRecord[] };
  error?: { message: string };
};

type DecisionResponse = {
  data?: { applicationId: number; collaborationId?: number; status?: string };
  error?: { message: string };
};

export function BrandApplications() {
  const [applications, setApplications] = useState<BrandApplicationRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [busyIds, setBusyIds] = useState<Set<number>>(() => new Set());
  const [actionErrors, setActionErrors] = useState<Record<number, string>>({});
  const [collaborationIds, setCollaborationIds] = useState<
    Record<number, number>
  >({});
  const inFlightIds = useRef(new Set<number>());

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch("/api/brand/applications", {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | ApplicationsResponse
          | null;
        if (!response.ok || !Array.isArray(payload?.data?.applications)) {
          throw new Error(
            payload?.error?.message ?? "We could not load applications.",
          );
        }
        setApplications(payload.data.applications);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "We could not load applications.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [retry]);

  async function decide(
    application: BrandApplicationRecord,
    decision: "accept" | "reject",
    formData: FormData,
  ) {
    if (inFlightIds.current.has(application.applicationId)) {
      return;
    }

    inFlightIds.current.add(application.applicationId);
    setActionErrors((current) => {
      const next = { ...current };
      delete next[application.applicationId];
      return next;
    });
    setBusyIds((current) => new Set(current).add(application.applicationId));

    const body =
      decision === "accept"
        ? {
            agreedAmount: String(formData.get("agreedAmount") ?? ""),
            startDate: String(formData.get("startDate") ?? ""),
            endDate: String(formData.get("endDate") ?? ""),
          }
        : {};

    try {
      const response = await fetch(
        `/api/applications/${application.applicationId}/${decision}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | DecisionResponse
        | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ??
            `We could not ${decision} this application.`,
        );
      }

      setApplications((current) =>
        current.map((item) =>
          item.applicationId === application.applicationId
            ? {
                ...item,
                status: decision === "accept" ? "Accepted" : "Rejected",
              }
            : item,
        ),
      );
      if (payload.data.collaborationId) {
        setCollaborationIds((current) => ({
          ...current,
          [application.applicationId]: payload.data!.collaborationId!,
        }));
      }
    } catch (error) {
      setActionErrors((current) => ({
        ...current,
        [application.applicationId]:
          error instanceof Error
            ? error.message
            : `We could not ${decision} this application.`,
      }));
    } finally {
      inFlightIds.current.delete(application.applicationId);
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(application.applicationId);
        return next;
      });
    }
  }

  if (loading) {
    return <section className="panel" role="status">Loading applications…</section>;
  }

  if (loadError) {
    return (
      <section className="panel error-panel" role="alert">
        <h2>Applications could not be loaded</h2>
        <p>{loadError}</p>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Try again
        </button>
      </section>
    );
  }

  if (applications.length === 0) {
    return (
      <WorkspaceEmptyState
        title="No creator applications yet"
        description="Applications from creators to your published campaigns will appear here."
        detail="Keep an Open campaign within its application dates to receive interest."
        action={
          <Link className="btn btn-secondary" href="/brand/campaigns">
            View campaigns
          </Link>
        }
      />
    );
  }

  return (
    <div className="panel-grid">
      {applications.map((application) => {
        const busy = busyIds.has(application.applicationId);
        const dateDefaults = {
          start: application.campaignStartDate ?? "",
          end: application.campaignEndDate ?? "",
        };
        return (
          <article className="panel" key={application.applicationId}>
            <header className="panel-header">
              <div>
                <h2>{application.campaignName}</h2>
                <p>
                  Applied {formatDate(application.appliedDate)} · campaign
                  budget INR {application.campaignBudget}
                </p>
              </div>
              <StatusBadge status={application.status} />
            </header>

            <section aria-label={`Creator ${application.creator.username}`}>
              <h3>
                {application.creator.firstName} {application.creator.lastName}
              </h3>
              <p>
                @{application.creator.username}
                {[application.creator.city, application.creator.state]
                  .filter(Boolean)
                  .map((place) => ` · ${place}`)
                  .join("")}
              </p>
              {application.creator.bio ? <p>{application.creator.bio}</p> : null}
            </section>

            <section>
              <h3>Social accounts</h3>
              {application.creator.socialAccounts.length === 0 ? (
                <p>No social accounts provided.</p>
              ) : (
                <ul>
                  {application.creator.socialAccounts.map((account) => (
                    <li key={`${account.platform}-${account.username}`}>
                      {account.platform} · @{account.username} ·{" "}
                      {formatNumber(account.followers)} followers ·{" "}
                      {account.engagementRate === null
                        ? "Engagement not set"
                        : `${account.engagementRate}% engagement`}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {actionErrors[application.applicationId] ? (
              <p className="form-error" role="alert">
                {actionErrors[application.applicationId]}
              </p>
            ) : null}
            {collaborationIds[application.applicationId] ? (
              <p className="form-success" role="status">
                Accepted.{" "}
                <Link
                  href={`/brand/collaborations/${collaborationIds[application.applicationId]}`}
                >
                  View collaboration
                </Link>
              </p>
            ) : null}

            {application.status === "Pending" ? (
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  void decide(
                    application,
                    "accept",
                    new FormData(event.currentTarget),
                  );
                }}
              >
                <h3>Accept application</h3>
                <div className="field">
                  <label
                    className="field-label"
                    htmlFor={`amount-${application.applicationId}`}
                  >
                    Agreed amount (INR)
                  </label>
                  <input
                    id={`amount-${application.applicationId}`}
                    name="agreedAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="field">
                  <label
                    className="field-label"
                    htmlFor={`start-${application.applicationId}`}
                  >
                    Collaboration start date
                  </label>
                  <input
                    id={`start-${application.applicationId}`}
                    name="startDate"
                    type="date"
                    defaultValue={dateDefaults.start}
                    required
                  />
                </div>
                <div className="field">
                  <label
                    className="field-label"
                    htmlFor={`end-${application.applicationId}`}
                  >
                    Collaboration end date
                  </label>
                  <input
                    id={`end-${application.applicationId}`}
                    name="endDate"
                    type="date"
                    defaultValue={dateDefaults.end}
                    required
                  />
                </div>
                <div className="page-actions">
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={busy}
                  >
                    {busy ? "Processing…" : "Accept and create collaboration"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={busy}
                    onClick={(event) => {
                      const form = event.currentTarget.form;
                      if (form) {
                        void decide(
                          application,
                          "reject",
                          new FormData(form),
                        );
                      }
                    }}
                  >
                    Reject
                  </button>
                </div>
              </form>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
