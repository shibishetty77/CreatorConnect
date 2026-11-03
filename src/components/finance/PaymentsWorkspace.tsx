"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/lib/format";
import type { PaymentRecord } from "@/lib/repositories/finance";

type PaymentRole = "creator" | "brand" | "admin";

type PaymentSummary = {
  pendingCount: number;
  paidCount: number;
  pendingAmount: string;
  paidAmount: string;
  totalAmount: string;
};

type PaymentsResponse = {
  data?: {
    payments: PaymentRecord[];
    total?: number;
    page?: number;
    totalPages?: number;
    summary?: PaymentSummary;
  };
  error?: { message: string };
};

type FilterState = {
  q: string;
  status: string;
  pageSize: number;
};

const defaultFilters: FilterState = {
  q: "",
  status: "all",
  pageSize: 8,
};

const emptySummary: PaymentSummary = {
  pendingCount: 0,
  paidCount: 0,
  pendingAmount: "0",
  paidAmount: "0",
  totalAmount: "0",
};

function todayInKolkata(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function PaymentsWorkspace({ role }: { role: PaymentRole }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<PaymentSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const endpoint =
    role === "creator"
      ? "/api/creator/payments"
      : role === "brand"
        ? "/api/brand/payments"
        : "/api/admin/payments";

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
          `${endpoint}${isCreator ? `?${params}` : ""}`,
          { signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | PaymentsResponse
          | null;

        if (!response.ok || !Array.isArray(payload?.data?.payments)) {
          throw new Error(
            payload?.error?.message ?? "Payments could not be loaded.",
          );
        }

        const loadedPayments = payload.data.payments;
        setPayments(loadedPayments);
        setTotal(payload.data.total ?? loadedPayments.length);
        setTotalPages(payload.data.totalPages ?? 1);

        if (payload.data.summary) {
          setSummary(payload.data.summary);
        } else {
          const pending = loadedPayments.filter(
            (payment) => payment.status === "Pending",
          );
          const paid = loadedPayments.filter(
            (payment) => payment.status === "Paid",
          );
          setSummary({
            pendingCount: pending.length,
            paidCount: paid.length,
            pendingAmount: pending
              .reduce((sum, payment) => sum + Number(payment.amount), 0)
              .toFixed(2),
            paidAmount: paid
              .reduce((sum, payment) => sum + Number(payment.amount), 0)
              .toFixed(2),
            totalAmount: loadedPayments
              .reduce((sum, payment) => sum + Number(payment.amount), 0)
              .toFixed(2),
          });
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Payments could not be loaded.",
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
  }, [endpoint, filters, page, retry, role]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFilters({
      q: String(formData.get("q") ?? "").trim(),
      status: String(formData.get("status") ?? "all"),
      pageSize: Number(formData.get("pageSize") ?? 8),
    });
    setPage(1);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setPage(1);
  }

  async function markPaid(payment: PaymentRecord) {
    if (busy !== null) return;

    const paymentDate = todayInKolkata();
    if (
      !window.confirm(
        "This records full settlement. A database trigger may mark the collaboration Completed. Continue?",
      )
    ) {
      return;
    }

    setBusy(payment.paymentId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/payments/${payment.paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Paid", paymentDate }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: { collaborationStatus: "Active" | "Completed" };
            error?: { message: string };
          }
        | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ?? "The payment could not be updated.",
        );
      }

      setMessage(
        `Payment marked Paid. Collaboration status: ${payload.data.collaborationStatus}.`,
      );
      setRetry((value) => value + 1);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "The payment could not be updated.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <section className="panel" role="status">
        Loading payments...
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel error-panel" role="alert">
        <h2>Payments could not be loaded</h2>
        <p>{error}</p>
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

  return (
    <div className="form-stack">
      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}

      {role === "creator" ? (
        <>
          <section className="panel filter-summary" aria-label="Payment totals">
            <span>Total recorded: {formatCurrency(summary.totalAmount)}</span>
            <span>Pending: {formatCurrency(summary.pendingAmount)}</span>
            <span>Paid: {formatCurrency(summary.paidAmount)}</span>
            <span>
              {formatNumber(summary.pendingCount)} pending,{" "}
              {formatNumber(summary.paidCount)} paid
            </span>
          </section>

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
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
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
              <button
                className="btn btn-secondary"
                type="button"
                onClick={resetFilters}
              >
                Clear
              </button>
            </div>
          </form>
        </>
      ) : null}

      {payments.length === 0 ? (
        <section className="panel">
          <p className="empty-note">
            {filters.q || filters.status !== "all"
              ? "No payments match these filters."
              : "No payment records are available."}
          </p>
          {role === "brand" ? (
            <p>Open a collaboration to create a full-settlement payment.</p>
          ) : null}
        </section>
      ) : (
        <>
          {role === "creator" ? (
            <p className="filter-summary" aria-live="polite">
              Showing {formatNumber(payments.length)} of{" "}
              {formatNumber(total)} payments.
            </p>
          ) : null}

          <div className="panel-grid">
            {payments.map((payment) => (
              <article className="panel" key={payment.paymentId}>
                <header className="panel-header">
                  <div>
                    <h2>{payment.campaignName}</h2>
                    <p>
                      {role === "creator"
                        ? payment.brandName
                        : `${payment.creatorName} (@${payment.creatorUsername})`}
                    </p>
                  </div>
                  <StatusBadge status={payment.status} />
                </header>
                <dl className="campaign-facts">
                  <div>
                    <dt>Payment amount</dt>
                    <dd>{formatCurrency(payment.amount)}</dd>
                  </div>
                  <div>
                    <dt>Agreed amount</dt>
                    <dd>{formatCurrency(payment.agreedAmount)}</dd>
                  </div>
                  <div>
                    <dt>Payment date</dt>
                    <dd>{formatDate(payment.paymentDate)}</dd>
                  </div>
                  <div>
                    <dt>Transaction reference</dt>
                    <dd>{payment.transactionReference ?? "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Collaboration</dt>
                    <dd>
                      <StatusBadge status={payment.collaborationStatus} />
                    </dd>
                  </div>
                </dl>
                <div className="page-actions">
                  {role === "admin" ? (
                    <Link
                      className="btn btn-secondary"
                      href="/admin/collaborations"
                    >
                      View collaborations
                    </Link>
                  ) : (
                    <Link
                      className="btn btn-secondary"
                      href={`/${role}/collaborations/${payment.collaborationId}`}
                    >
                      View collaboration
                    </Link>
                  )}
                  {role !== "creator" && payment.status === "Pending" ? (
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void markPaid(payment)}
                    >
                      {busy === payment.paymentId
                        ? "Updating..."
                        : "Mark full settlement paid"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {role === "creator" ? (
            <nav className="pagination" aria-label="Payment pages">
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
