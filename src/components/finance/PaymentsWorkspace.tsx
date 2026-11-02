"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/format";
import type { PaymentRecord } from "@/lib/repositories/finance";

type PaymentRole = "creator" | "brand" | "admin";
type PaymentsResponse = {
  data?: { payments: PaymentRecord[] };
  error?: { message: string };
};

function todayInKolkata(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function PaymentsWorkspace({ role }: { role: PaymentRole }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
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
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        const payload = (await response.json().catch(() => null)) as
          | PaymentsResponse
          | null;
        if (!response.ok || !Array.isArray(payload?.data?.payments)) {
          throw new Error(payload?.error?.message ?? "Payments could not be loaded.");
        }
        setPayments(payload.data.payments);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Payments could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [endpoint, retry]);

  async function markPaid(payment: PaymentRecord) {
    if (busy !== null) return;
    const paymentDate = todayInKolkata();
    if (!window.confirm(
      "This records full settlement. A database trigger may mark the collaboration Completed. Continue?",
    )) return;
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
        | { data?: { collaborationStatus: "Active" | "Completed" }; error?: { message: string } }
        | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? "The payment could not be updated.");
      }
      setMessage(
        `Payment marked Paid. Collaboration status: ${payload.data.collaborationStatus}.`,
      );
      setRetry((value) => value + 1);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "The payment could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <section className="panel" role="status">Loading payments…</section>;
  if (error) {
    return (
      <section className="panel error-panel" role="alert">
        <h2>Payments could not be loaded</h2>
        <p>{error}</p>
        <button className="btn btn-primary" type="button" onClick={() => setRetry((value) => value + 1)}>
          Try again
        </button>
      </section>
    );
  }

  return (
    <div className="form-stack">
      {message ? <p className="form-success" role="status">{message}</p> : null}
      {payments.length === 0 ? (
        <section className="panel">
          <p className="empty-note">No payment records are available.</p>
          {role === "brand" ? (
            <p>Open a collaboration to create a full-settlement payment.</p>
          ) : null}
        </section>
      ) : (
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
                <div><dt>Payment amount</dt><dd>INR {payment.amount}</dd></div>
                <div><dt>Agreed amount</dt><dd>INR {payment.agreedAmount}</dd></div>
                <div><dt>Payment date</dt><dd>{formatDate(payment.paymentDate)}</dd></div>
                <div>
                  <dt>Collaboration</dt>
                  <dd>
                    <StatusBadge status={payment.collaborationStatus} />
                  </dd>
                </div>
              </dl>
              <div className="page-actions">
                {role === "admin" ? (
                  <Link className="btn btn-secondary" href="/admin/collaborations">
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
                    {busy === payment.paymentId ? "Updating…" : "Mark full settlement paid"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
