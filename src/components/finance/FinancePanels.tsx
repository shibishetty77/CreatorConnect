"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/format";
import type { CollaborationRecord } from "@/lib/repositories/collaborations";
import type {
  MetricsRecord,
  PaymentRecord,
  ReviewRecord,
} from "@/lib/repositories/finance";

type FinancePanelsProps = {
  collaboration: CollaborationRecord;
  role: "Creator" | "Brand";
};

type ApiResult<T> = {
  data?: T;
  error?: { message: string };
};

type FinanceData = {
  payments: PaymentRecord[];
  metrics: MetricsRecord | null;
  review: ReviewRecord | null;
};

const metricFields = [
  ["views", "Views"],
  ["likes", "Likes"],
  ["comments", "Comments"],
  ["shares", "Shares"],
  ["clicks", "Clicks"],
] as const;

function todayUtc(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function FinancePanels({ collaboration, role }: FinancePanelsProps) {
  const [data, setData] = useState<FinanceData>({
    payments: [],
    metrics: null,
    review: null,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [paymentDate, setPaymentDate] = useState(todayUtc());
  const [collaborationStatus, setCollaborationStatus] = useState(
    collaboration.status,
  );
  const [rating, setRating] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [metrics, setMetrics] = useState<Record<string, string>>({
    views: "0",
    likes: "0",
    comments: "0",
    shares: "0",
    clicks: "0",
  });
  const inFlight = useRef(false);
  const paymentsPath = `/api/collaborations/${collaboration.collaborationId}/payments`;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [paymentResponse, metricsResponse, reviewResponse] =
          await Promise.all([
            fetch(paymentsPath, { signal: controller.signal }),
            fetch(
              `/api/collaborations/${collaboration.collaborationId}/metrics`,
              { signal: controller.signal },
            ),
            fetch(
              `/api/collaborations/${collaboration.collaborationId}/review`,
              { signal: controller.signal },
            ),
          ]);
        const [paymentPayload, metricsPayload, reviewPayload] =
          (await Promise.all([
            paymentResponse.json(),
            metricsResponse.json(),
            reviewResponse.json(),
          ])) as [
            ApiResult<{ payments: PaymentRecord[] }>,
            ApiResult<{ metrics: MetricsRecord | null }>,
            ApiResult<{ review: ReviewRecord | null }>,
          ];

        if (
          !paymentResponse.ok ||
          !Array.isArray(paymentPayload.data?.payments)
        ) {
          throw new Error(
            paymentPayload.error?.message ?? "Payment information could not be loaded.",
          );
        }
        if (!metricsResponse.ok || !metricsPayload.data) {
          throw new Error(
            metricsPayload.error?.message ?? "Metrics could not be loaded.",
          );
        }
        if (!reviewResponse.ok || !reviewPayload.data) {
          throw new Error(
            reviewPayload.error?.message ?? "Review information could not be loaded.",
          );
        }

        setData({
          payments: paymentPayload.data.payments.filter(
            (payment) =>
              payment.collaborationId === collaboration.collaborationId,
          ),
          metrics: metricsPayload.data.metrics,
          review: reviewPayload.data.review,
        });
        if (metricsPayload.data.metrics) {
          setMetrics({
            views: metricsPayload.data.metrics.views,
            likes: metricsPayload.data.metrics.likes,
            comments: metricsPayload.data.metrics.comments,
            shares: metricsPayload.data.metrics.shares,
            clicks: metricsPayload.data.metrics.clicks,
          });
        }
        if (reviewPayload.data.review) {
          setRating(String(reviewPayload.data.review.rating));
          setFeedback(reviewPayload.data.review.feedback ?? "");
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setLoadError(
            loadError instanceof Error
              ? loadError.message
              : "Finance details could not be loaded.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [collaboration.collaborationId, paymentsPath, retry]);

  async function mutate(
    url: string,
    method: "POST" | "PATCH" | "PUT",
    body: unknown,
  ): Promise<unknown | false> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiResult<unknown>
        | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? "The operation failed.");
      }
      setSuccess("Saved successfully.");
      setRetry((value) => value + 1);
      return payload.data;
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "The operation failed.",
      );
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void mutate(
      `/api/collaborations/${collaboration.collaborationId}/payments`,
      "POST",
      {
        amount: collaboration.agreedAmount,
        status: "Pending",
        paymentDate: null,
      },
    );
  }

  function markPaid(payment: PaymentRecord) {
    if (!window.confirm(
      "Mark this full-settlement payment as Paid? The database trigger may complete the collaboration.",
    )) {
      return;
    }
    void mutate(`/api/payments/${payment.paymentId}`, "PATCH", {
      status: "Paid",
      paymentDate: paymentDate || todayUtc(),
    }).then((result) => {
      if (
        result &&
        typeof result === "object" &&
        "collaborationStatus" in result &&
        (result.collaborationStatus === "Active" ||
          result.collaborationStatus === "Completed")
      ) {
        setCollaborationStatus(result.collaborationStatus);
      }
    });
  }

  function saveMetrics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void mutate(
      `/api/collaborations/${collaboration.collaborationId}/metrics`,
      "PUT",
      metrics,
    );
  }

  function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void mutate(
      `/api/collaborations/${collaboration.collaborationId}/review`,
      "PUT",
      { rating: Number(rating), feedback },
    );
  }

  if (loading) {
    return <section className="panel" role="status">Loading payments, metrics, and review…</section>;
  }
  if (loadError) {
    return (
      <section className="panel error-panel" role="alert">
        <h2>Collaboration finance details could not be loaded</h2>
        <p>{loadError}</p>
        <button className="btn btn-primary" type="button" onClick={() => setRetry((value) => value + 1)}>
          Try again
        </button>
      </section>
    );
  }

  const payment = data.payments[0] ?? null;

  return (
    <div className="panel-grid">
      <section className="panel form-stack">
        <h2>Payment</h2>
        {payment ? (
          <>
            <dl className="campaign-facts">
              <div><dt>Amount</dt><dd>INR {payment.amount}</dd></div>
              <div><dt>Payment date</dt><dd>{formatDate(payment.paymentDate)}</dd></div>
              <div><dt>Payment status</dt><dd><StatusBadge status={payment.status} /></dd></div>
              <div><dt>Collaboration status</dt><dd><StatusBadge status={collaborationStatus} /></dd></div>
            </dl>
            {role === "Brand" && payment.status === "Pending" ? (
              <>
                <div className="field">
                  <label className="field-label" htmlFor={`payment-date-${collaboration.collaborationId}`}>
                    Paid date
                  </label>
                  <input
                    id={`payment-date-${collaboration.collaborationId}`}
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                  />
                </div>
                <button className="btn btn-primary" type="button" disabled={saving} onClick={() => markPaid(payment)}>
                  Mark full settlement paid
                </button>
              </>
            ) : null}
          </>
        ) : role === "Brand" ? (
          collaborationStatus === "Active" ? (
            <form onSubmit={createPayment}>
              <p>
                Create one pending full-settlement record for the agreed amount
                (INR {collaboration.agreedAmount}). Partial payments are not supported.
              </p>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                Create pending payment
              </button>
            </form>
          ) : (
            <p className="empty-note">No payment record exists for this completed collaboration.</p>
          )
        ) : (
          <p className="empty-note">No payment has been recorded yet.</p>
        )}
      </section>

      <section className="panel form-stack">
        <h2>Performance metrics</h2>
        {data.metrics ? (
          <dl className="campaign-facts">
            {metricFields.map(([key, label]) => (
              <div key={key}><dt>{label}</dt><dd>{data.metrics?.[key]}</dd></div>
            ))}
          </dl>
        ) : (
          <p className="empty-note">No performance metrics have been recorded.</p>
        )}
        {role === "Brand" ? (
          <form className="form-stack" onSubmit={saveMetrics}>
            {metricFields.map(([key, label]) => (
              <div className="field" key={key}>
                <label className="field-label" htmlFor={`${key}-${collaboration.collaborationId}`}>
                  {label}
                </label>
                <input
                  id={`${key}-${collaboration.collaborationId}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={metrics[key]}
                  onChange={(event) =>
                    setMetrics((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </div>
            ))}
            <button className="btn btn-secondary" type="submit" disabled={saving}>
              Save metrics
            </button>
          </form>
        ) : null}
      </section>

      <section className="panel form-stack">
        <h2>Collaboration review</h2>
        {data.review ? (
          <div>
            <p>
              Rating: {data.review.rating}/5 · reviewed{" "}
              {formatDate(data.review.reviewDate)}
            </p>
            {data.review.feedback ? <p>{data.review.feedback}</p> : null}
          </div>
        ) : (
          <p className="empty-note">No review has been recorded.</p>
        )}
        {role === "Brand" && collaborationStatus === "Completed" ? (
          <>
            <p className="page-eyebrow">
              Reviews do not store reviewer identity in the database.
            </p>
            <form className="form-stack" onSubmit={saveReview}>
              <div className="field">
                <label className="field-label" htmlFor={`review-rating-${collaboration.collaborationId}`}>
                  Rating
                </label>
                <select
                  id={`review-rating-${collaboration.collaborationId}`}
                  value={rating}
                  onChange={(event) => setRating(event.target.value)}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>{value} / 5</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`review-feedback-${collaboration.collaborationId}`}>
                  Feedback
                </label>
                <textarea
                  id={`review-feedback-${collaboration.collaborationId}`}
                  maxLength={5000}
                  rows={4}
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {data.review ? "Update review" : "Submit review"}
              </button>
            </form>
          </>
        ) : null}
      </section>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {success ? <p className="form-success" role="status">{success}</p> : null}
    </div>
  );
}
