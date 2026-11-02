"use client";

import { useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { CreatorCampaignRecord } from "@/lib/repositories/campaign-discovery";

type CampaignListResponse = {
  data?: {
    campaigns: CreatorCampaignRecord[];
  };
  error?: {
    message: string;
  };
};

type ApplicationResponse = {
  data?: {
    application: {
      applicationId: number;
      status: "Pending";
    };
  };
  error?: {
    message: string;
    fields?: Record<string, string>;
  };
};

export function CampaignDiscovery() {
  const [campaigns, setCampaigns] = useState<CreatorCampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const applyingCampaignIdsRef = useRef(new Set<number>());
  const [applyingCampaignIds, setApplyingCampaignIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [applicationErrors, setApplicationErrors] = useState<
    Record<number, string>
  >({});
  const [applicationSuccesses, setApplicationSuccesses] = useState<
    Record<number, string>
  >({});

  useEffect(() => {
    const controller = new AbortController();

    async function loadCampaigns() {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await fetch("/api/creator/campaigns", {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | CampaignListResponse
          | null;

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ??
              "We could not load campaigns. Please try again.",
          );
        }

        if (!Array.isArray(payload?.data?.campaigns)) {
          throw new Error("The campaign list response was invalid.");
        }

        setCampaigns(payload.data.campaigns);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "We could not load campaigns. Please try again.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadCampaigns();

    return () => controller.abort();
  }, [retryCount]);

  async function applyToCampaign(campaign: CreatorCampaignRecord) {
    if (applyingCampaignIdsRef.current.has(campaign.campaignId)) {
      return;
    }

    applyingCampaignIdsRef.current.add(campaign.campaignId);
    setApplyingCampaignIds(new Set(applyingCampaignIdsRef.current));
    setApplicationErrors((current) => {
      const next = { ...current };
      delete next[campaign.campaignId];
      return next;
    });

    try {
      const response = await fetch(
        `/api/creator/campaigns/${campaign.campaignId}/applications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | ApplicationResponse
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error?.fields?.eligibility ??
            payload?.error?.message ??
            "We could not submit your application. Please try again.",
        );
      }

      if (payload?.data?.application?.status !== "Pending") {
        throw new Error(
          "The application response was invalid. Please check your applications before trying again.",
        );
      }

      setCampaigns((current) =>
        current.map((item) =>
          item.campaignId === campaign.campaignId
            ? { ...item, applicationStatus: "Pending" }
            : item,
        ),
      );
      setApplicationSuccesses((current) => ({
        ...current,
        [campaign.campaignId]: "Your application was submitted successfully.",
      }));
    } catch (error) {
      setApplicationErrors((current) => ({
        ...current,
        [campaign.campaignId]:
          error instanceof Error
            ? error.message
            : "We could not submit your application. Please try again.",
      }));
    } finally {
      applyingCampaignIdsRef.current.delete(campaign.campaignId);
      setApplyingCampaignIds(new Set(applyingCampaignIdsRef.current));
    }
  }

  if (loading) {
    return (
      <section className="panel" role="status" aria-live="polite">
        Loading open campaigns…
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="panel error-panel" role="alert">
        <h2>Campaigns could not be loaded</h2>
        <p>{loadError}</p>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
        >
          Try again
        </button>
      </section>
    );
  }

  if (campaigns.length === 0) {
    return (
      <section className="panel">
        <p className="empty-note">
          There are no open campaigns right now. Check back later.
        </p>
      </section>
    );
  }

  return (
    <div className="panel-grid">
      {campaigns.map((campaign) => {
        const isApplying = applyingCampaignIds.has(campaign.campaignId);
        const isFull = campaign.remainingSlots <= 0;
        const hasApplied = campaign.applicationStatus !== null;

        return (
          <article className="panel" key={campaign.campaignId}>
            <div className="page-heading">
              <div>
                <span className="page-eyebrow">
                  {campaign.categoryName ?? "Open campaign"}
                </span>
                <h2>{campaign.campaignName}</h2>
                <p>{campaign.brandName}</p>
              </div>
              {campaign.applicationStatus ? (
                <StatusBadge status={campaign.applicationStatus} />
              ) : null}
            </div>

            {campaign.description ? <p>{campaign.description}</p> : null}

            <dl className="campaign-facts">
              <div>
                <dt>Total campaign budget</dt>
                <dd>{formatCurrency(campaign.budget)}</dd>
              </div>
              <div>
                <dt>Campaign dates</dt>
                <dd>
                  {formatDate(campaign.startDate)} –{" "}
                  {formatDate(campaign.endDate)}
                </dd>
              </div>
              <div>
                <dt>Minimum followers per account</dt>
                <dd>{formatNumber(campaign.minFollowers)}</dd>
              </div>
              <div>
                <dt>Accepted creator slots remaining</dt>
                <dd>{formatNumber(campaign.remainingSlots)}</dd>
              </div>
            </dl>

            <section aria-label={`Requirements for ${campaign.campaignName}`}>
              <h3>Requirements</h3>
              {campaign.requirements.length === 0 ? (
                <p>No platform-specific requirements.</p>
              ) : (
                <ul>
                  {campaign.requirements.map((requirement) => (
                    <li key={requirement.requirementId}>
                      {requirement.platform ?? "Any platform"}
                      {requirement.minEngagementRate !== null
                        ? ` · at least ${formatPercent(requirement.minEngagementRate)} engagement`
                        : ""}
                      {requirement.requiredNiche
                        ? ` · niche: ${requirement.requiredNiche} (informational)`
                        : ""}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {hasApplied && !applicationSuccesses[campaign.campaignId] ? (
              <p className="form-success" role="status">
                You have already applied to this campaign.
              </p>
            ) : null}
            {applicationSuccesses[campaign.campaignId] ? (
              <p className="form-success" role="status">
                {applicationSuccesses[campaign.campaignId]}
              </p>
            ) : null}
            {applicationErrors[campaign.campaignId] ? (
              <p className="form-error" role="alert">
                {applicationErrors[campaign.campaignId]}
              </p>
            ) : null}
            {!campaign.eligible && !hasApplied ? (
              <ul className="form-error" aria-label="Eligibility requirements">
                {campaign.eligibilityReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            {isFull && !hasApplied ? (
              <p className="form-error" role="status">
                This campaign has reached its creator limit.
              </p>
            ) : null}

            {!hasApplied ? (
              <button
                className="btn btn-primary"
                type="button"
                disabled={!campaign.eligible || isFull || isApplying}
                onClick={() => void applyToCampaign(campaign)}
              >
                {isApplying
                  ? "Applying…"
                  : isFull
                    ? "Campaign full"
                    : campaign.eligible
                      ? "Apply"
                      : "Not eligible"}
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
