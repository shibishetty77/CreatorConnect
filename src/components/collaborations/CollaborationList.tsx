"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/format";
import type { CollaborationRecord } from "@/lib/repositories/collaborations";

type CollaborationListResponse = {
  data?: { collaborations: CollaborationRecord[] };
  error?: { message: string };
};

type CollaborationListProps = {
  role: "creator" | "brand";
};

export function CollaborationList({ role }: CollaborationListProps) {
  const [collaborations, setCollaborations] = useState<CollaborationRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/${role}/collaborations`, {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | CollaborationListResponse
          | null;
        if (!response.ok || !Array.isArray(payload?.data?.collaborations)) {
          throw new Error(
            payload?.error?.message ?? "We could not load collaborations.",
          );
        }
        setCollaborations(payload.data.collaborations);
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
  }, [retry, role]);

  if (loading) {
    return (
      <section className="panel" role="status">
        Loading collaborations…
      </section>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (collaborations.length === 0) {
    return (
      <section className="panel">
        <p className="empty-note">
          {role === "creator"
            ? "Accepted applications will appear here."
            : "Accepted creator applications will appear here."}
        </p>
      </section>
    );
  }

  return (
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
              <dd>INR {collaboration.agreedAmount}</dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>
                {formatDate(collaboration.startDate)} –{" "}
                {formatDate(collaboration.endDate)}
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
  );
}
