"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { formatDate } from "@/lib/format";
import type { CollaborationRecord } from "@/lib/repositories/collaborations";

type ContractRecord = {
  contractId: number;
  collaborationId: number;
  campaignName: string;
  creatorName: string;
  creatorUsername: string;
  brandName: string;
  agreedAmount: string;
  collaborationStartDate: string;
  collaborationEndDate: string;
  signedDate: string | null;
  expiryDate: string | null;
};

type ContractResponse = {
  data?: { contract: ContractRecord | null };
  error?: { message: string };
};

export function ContractPanel({
  collaboration,
  role,
}: {
  collaboration: CollaborationRecord;
  role: "creator" | "brand";
}) {
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [signedDate, setSignedDate] = useState(
    collaboration.startDate.slice(0, 10),
  );
  const [expiryDate, setExpiryDate] = useState(
    collaboration.endDate.slice(0, 10),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const saveInFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/collaborations/${collaboration.collaborationId}/contract`,
          { signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | ContractResponse
          | null;
        if (!response.ok || !payload?.data) {
          throw new Error(
            payload?.error?.message ?? "We could not load contract details.",
          );
        }
        setContract(payload.data.contract);
        if (payload.data.contract?.signedDate) {
          setSignedDate(payload.data.contract.signedDate.slice(0, 10));
        }
        if (payload.data.contract?.expiryDate) {
          setExpiryDate(payload.data.contract.expiryDate.slice(0, 10));
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "We could not load contract details.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [collaboration.collaborationId, retry]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/brand/collaborations/${collaboration.collaborationId}/contract`,
        {
          method: contract ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedDate, expiryDate }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | ContractResponse
        | null;
      if (!response.ok || !payload?.data?.contract) {
        throw new Error(
          payload?.error?.message ?? "We could not save contract dates.",
        );
      }
      setContract(payload.data.contract);
      setSuccess(contract ? "Contract dates updated." : "Printable contract summary generated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save contract dates.",
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="panel form-stack">
      <header className="panel-header">
        <div>
          <h2>Contract</h2>
          <p>Generated from stored collaboration and contract details.</p>
        </div>
      </header>

      {loading ? <p role="status">Loading contract…</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {success ? <p className="form-success" role="status">{success}</p> : null}
      {!loading && error ? (
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry loading contract
        </button>
      ) : null}

      {!loading && contract ? (
        <article className="form-stack" aria-label="Printable contract summary">
          <h3>CreatorConnect collaboration agreement summary</h3>
          <dl className="campaign-facts">
            <div><dt>Campaign</dt><dd>{contract.campaignName}</dd></div>
            <div><dt>Brand</dt><dd>{contract.brandName}</dd></div>
            <div>
              <dt>Creator</dt>
              <dd>{contract.creatorName} (@{contract.creatorUsername})</dd>
            </div>
            <div>
              <dt>Agreed amount</dt>
              <dd>INR {contract.agreedAmount}</dd>
            </div>
            <div>
              <dt>Collaboration period</dt>
              <dd>
                {formatDate(contract.collaborationStartDate)} –{" "}
                {formatDate(contract.collaborationEndDate)}
              </dd>
            </div>
            <div><dt>Signed date</dt><dd>{formatDate(contract.signedDate)}</dd></div>
            <div><dt>Expiry date</dt><dd>{formatDate(contract.expiryDate)}</dd></div>
          </dl>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => window.print()}
          >
            Print contract summary
          </button>
        </article>
      ) : null}

      {!loading && !error && role === "brand" ? (
        <form className="form-stack" onSubmit={(event) => void save(event)}>
          <h3>{contract ? "Update contract dates" : "Generate contract summary"}</h3>
          {!contract ? (
            <p>
              The database stores contract dates, not a document. This generates
              a printable summary from the existing collaboration details.
            </p>
          ) : null}
          <div className="field">
            <label className="field-label" htmlFor={`contract-signed-${collaboration.collaborationId}`}>
              Signed date
            </label>
            <input
              id={`contract-signed-${collaboration.collaborationId}`}
              type="date"
              required
              value={signedDate}
              onChange={(event) => setSignedDate(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`contract-expiry-${collaboration.collaborationId}`}>
              Expiry date
            </label>
            <input
              id={`contract-expiry-${collaboration.collaborationId}`}
              type="date"
              required
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : contract ? "Save contract dates" : "Generate contract"}
          </button>
        </form>
      ) : null}

      {!loading && !contract && role === "creator" ? (
        <p className="empty-note">The brand has not generated a contract summary yet.</p>
      ) : null}
    </section>
  );
}
