"use client";

import { useState, type FormEvent } from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ContractPanel } from "@/components/delivery/ContractPanel";
import { FinancePanels } from "@/components/finance/FinancePanels";
import { formatDate } from "@/lib/format";
import type { CollaborationRecord } from "@/lib/repositories/collaborations";

type CollaborationDetailsProps = {
  initialCollaboration: CollaborationRecord;
  canEdit: boolean;
};

type UpdateResponse = {
  data?: { collaboration: CollaborationRecord };
  error?: { message: string; fields?: Record<string, string> };
};

export function CollaborationDetails({
  initialCollaboration,
  canEdit,
}: CollaborationDetailsProps) {
  const [collaboration, setCollaboration] = useState(initialCollaboration);
  const [status, setStatus] = useState(initialCollaboration.status);
  const [startDate, setStartDate] = useState(initialCollaboration.startDate);
  const [endDate, setEndDate] = useState(initialCollaboration.endDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/collaborations/${collaboration.collaborationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, startDate, endDate }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | UpdateResponse
        | null;

      if (!response.ok || !payload?.data?.collaboration) {
        throw new Error(
          payload?.error?.message ??
            "We could not update this collaboration. Please try again.",
        );
      }

      setCollaboration(payload.data.collaboration);
      setStatus(payload.data.collaboration.status);
      setStartDate(payload.data.collaboration.startDate);
      setEndDate(payload.data.collaboration.endDate);
      setSuccess("Collaboration updated.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "We could not update this collaboration. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel-grid">
      <section className="panel">
        <header className="panel-header">
          <div>
            <span className="page-eyebrow">{collaboration.brandName}</span>
            <h2>{collaboration.campaignName}</h2>
          </div>
          <StatusBadge status={collaboration.status} />
        </header>
        <dl className="campaign-facts">
          <div>
            <dt>Creator</dt>
            <dd>
              {collaboration.creatorName} (@{collaboration.creatorUsername})
            </dd>
          </div>
          <div>
            <dt>Agreed amount</dt>
            <dd>INR {collaboration.agreedAmount}</dd>
          </div>
          <div>
            <dt>Start date</dt>
            <dd>{formatDate(collaboration.startDate)}</dd>
          </div>
          <div>
            <dt>End date</dt>
            <dd>{formatDate(collaboration.endDate)}</dd>
          </div>
        </dl>
      </section>

      {canEdit ? (
        <form className="panel form-stack" onSubmit={(event) => void update(event)}>
          <h2>Update collaboration</h2>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="form-success" role="status">
              {success}
            </p>
          ) : null}
          <div className="field">
            <label className="field-label" htmlFor="collaboration-status">
              Status
            </label>
            <select
              id="collaboration-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "Active" | "Completed")
              }
            >
              <option value="Active" disabled={collaboration.status === "Completed"}>
                Active
              </option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="collaboration-start-date">
              Start date
            </label>
            <input
              id="collaboration-start-date"
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="collaboration-end-date">
              End date
            </label>
            <input
              id="collaboration-end-date"
              type="date"
              required
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      ) : null}

      <ContractPanel
        collaboration={collaboration}
        role={canEdit ? "brand" : "creator"}
      />
      <FinancePanels
        collaboration={collaboration}
        role={canEdit ? "Brand" : "Creator"}
      />
    </div>
  );
}
