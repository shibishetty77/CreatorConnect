"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type {
  CollaborationRecord,
  CollaborationStatus,
} from "@/lib/repositories/collaborations";

type CollaborationListResponse = {
  data?: {
    collaborations: CollaborationRecord[];
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    statusCounts?: Record<CollaborationStatus, number>;
  };
  error?: { message: string };
};

type CollaborationListProps = {
  role: "creator" | "brand";
};

type FilterState = {
  q: string;
  status: string;
  pageSize: number;
};

const defaultFilters: FilterState = {
  q: "",
  status: "all",
  pageSize: 6,
};

export function CollaborationList({ role }: CollaborationListProps) {
  const [collaborations, setCollaborations] = useState<CollaborationRecord[]>(
    [],
  );
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState<
    Record<CollaborationStatus, number>
  >({ Active: 0, Completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      const isCreator = role === "creator";

      if (isCreator) {
        params.set("status", filters.status);
        params.set("page", String(page));
        params.set("pageSize", String(filters.pageSize));

        if (filters.q) {
          params.set("q", filters.q);
        }
      }

      try {
        const response = await fetch(
          `/api/${role}/collaborations${isCreator ? `?${params}` : ""}`,
          { signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | CollaborationListResponse
          | null;

        if (!response.ok || !Array.isArray(payload?.data?.collaborations)) {
          throw new Error(
            payload?.error?.message ?? "We could not load collaborations.",
          );
        }

        setCollaborations(payload.data.collaborations);
        setTotal(payload.data.total ?? payload.data.collaborations.length);
        setTotalPages(payload.data.totalPages ?? 1);
        setStatusCounts(
          payload.data.statusCounts ?? { Active: 0, Completed: 0 },
        );
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "We could not load collaborations.",
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
  }, [filters, page, retry, role]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFilters({
      q: String(formData.get("q") ?? "").trim(),
      status: String(formData.get("status") ?? "all"),
      pageSize: Number(formData.get("pageSize") ?? 6),
    });
    setPage(1);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setPage(1);
  }

  return (
    <div className="form-stack">
      {role === "creator" ? (
        <form className="panel admin-filter-form" onSubmit={handleFilterSubmit}>
          <label className="field">
            <span className="field-label">Search</span>
            <input
              name="q"
              maxLength={120}
              defaultValue={filters.q}
              placeholder="Campaign or brand name"
            />
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select name="status" defaultValue={filters.status}>
              <option value="all">All statuses</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Rows per page</span>
            <select name="pageSize" defaultValue={String(filters.pageSize)}>
              <option value="6">6</option>
              <option value="12">12</option>
              <option value="24">24</option>
            </select>
          </label>
          <div className="page-actions">
            <button className="btn btn-primary" type="submit">
              Apply filters
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={resetFilters}
            >
              Clear
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <section className="panel" role="status">
          Loading collaborations...
        </section>
      ) : error ? (
        <section className="panel error-panel" role="alert">
          <h2>Collaborations could not be loaded</h2>
          <p>{error}</p>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </section>
      ) : collaborations.length === 0 ? (
        <section className="panel">
          <p className="empty-note">
            {filters.q || filters.status !== "all"
              ? "No collaborations match these filters."
              : role === "creator"
                ? "Accepted applications will appear here."
                : "Accepted creator applications will appear here."}
          </p>
        </section>
      ) : (
        <>
          {role === "creator" ? (
            <section
              className="panel filter-summary"
              aria-label="Collaboration totals"
            >
              <span>Total: {formatNumber(total)}</span>
              <span>Active: {formatNumber(statusCounts.Active)}</span>
              <span>Completed: {formatNumber(statusCounts.Completed)}</span>
            </section>
          ) : null}

          <div className="panel-grid">
            {collaborations.map((collaboration) => (
              <article className="panel" key={collaboration.collaborationId}>
                <header className="panel-header">
                  <div>
                    <h2>{collaboration.campaignName}</h2>
                    <p>
                      {role === "creator"
                        ? collaboration.brandName
                        : collaboration.creatorName}
                    </p>
                  </div>
                  <StatusBadge status={collaboration.status} />
                </header>
                <dl className="campaign-facts">
                  <div>
                    <dt>Agreed amount</dt>
                    <dd>{formatCurrency(collaboration.agreedAmount)}</dd>
                  </div>
                  <div>
                    <dt>Dates</dt>
                    <dd>
                      {formatDate(collaboration.startDate)} to{" "}
                      {formatDate(collaboration.endDate)}
                    </dd>
                  </div>
                  <div>
                    <dt>Deliverables completed</dt>
                    <dd>
                      {formatNumber(collaboration.completedDeliverableCount)} of{" "}
                      {formatNumber(collaboration.deliverableCount)}
                    </dd>
                  </div>
                  <div>
                    <dt>Next pending deadline</dt>
                    <dd>
                      {collaboration.nextDueDate
                        ? formatDate(collaboration.nextDueDate)
                        : "None pending"}
                    </dd>
                  </div>
                </dl>
                <Link
                  className="btn btn-secondary"
                  href={`/${role}/collaborations/${collaboration.collaborationId}`}
                >
                  View collaboration
                </Link>
              </article>
            ))}
          </div>

          {role === "creator" ? (
            <nav className="pagination" aria-label="Collaboration pages">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span>
                Page {formatNumber(page)} of {formatNumber(totalPages)}
              </span>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
