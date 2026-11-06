"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type {
  CampaignFilterOptions,
  CreatorCampaignRecord,
} from "@/lib/repositories/campaign-discovery";

type CampaignListResponse = {
  data?: {
    campaigns: CreatorCampaignRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    filters: CampaignFilterOptions;
  };
  error?: {
    message: string;
    fields?: Record<string, string>;
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

type FilterState = {
  q: string;
  categoryId: string;
  platform: string;
  minBudget: string;
  maxBudget: string;
  status: string;
  sort: string;
};

const defaultFilters: FilterState = {
  q: "",
  categoryId: "",
  platform: "",
  minBudget: "",
  maxBudget: "",
  status: "Open",
  sort: "newest",
};

const fallbackPlatforms = [
  "Instagram",
  "YouTube",
  "LinkedIn",
  "Twitter",
  "Facebook",
];

const pageSize = 6;
const campaignVisuals = [
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1100&q=82",
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1100&q=82",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1100&q=82",
];

function filtersFromFormData(formData: FormData): FilterState {
  return {
    q: String(formData.get("q") ?? "").trim(),
    categoryId: String(formData.get("categoryId") ?? ""),
    platform: String(formData.get("platform") ?? ""),
    minBudget: String(formData.get("minBudget") ?? ""),
    maxBudget: String(formData.get("maxBudget") ?? ""),
    status: String(formData.get("status") ?? "Open"),
    sort: String(formData.get("sort") ?? "newest"),
  };
}

export function CampaignDiscovery() {
  const [campaigns, setCampaigns] = useState<CreatorCampaignRecord[]>([]);
  const [options, setOptions] = useState<CampaignFilterOptions>({
    categories: [],
    platforms: [],
  });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
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

      const params = new URLSearchParams();
      params.set("status", appliedFilters.status || "Open");
      params.set("sort", appliedFilters.sort || "newest");
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      if (appliedFilters.q) params.set("q", appliedFilters.q);
      if (appliedFilters.categoryId) {
        params.set("categoryId", appliedFilters.categoryId);
      }
      if (appliedFilters.platform) {
        params.set("platform", appliedFilters.platform);
      }
      if (appliedFilters.minBudget) {
        params.set("minBudget", appliedFilters.minBudget);
      }
      if (appliedFilters.maxBudget) {
        params.set("maxBudget", appliedFilters.maxBudget);
      }

      try {
        const response = await fetch(`/api/creator/campaigns?${params}`, {
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
        setTotal(payload.data.total);
        setTotalPages(payload.data.totalPages);
        setOptions(payload.data.filters);
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
  }, [appliedFilters, page, retryCount]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filtersFromFormData(new FormData(event.currentTarget)));
    setPage(1);
  }

  function resetFilters() {
    setAppliedFilters(defaultFilters);
    setPage(1);
  }

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

  const platformOptions =
    options.platforms.length > 0 ? options.platforms : fallbackPlatforms;

  return (
    <div className="form-stack">
      <form className="panel admin-filter-form" onSubmit={handleFilterSubmit}>
        <label className="field">
          <span className="field-label">Search campaigns</span>
          <input
            name="q"
            maxLength={120}
            defaultValue={appliedFilters.q}
            placeholder="Title or description"
          />
        </label>
        <label className="field">
          <span className="field-label">Category</span>
          <select name="categoryId" defaultValue={appliedFilters.categoryId}>
            <option value="">All categories</option>
            {options.categories.map((category) => (
              <option key={category.categoryId} value={category.categoryId}>
                {category.categoryName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Platform</span>
          <select name="platform" defaultValue={appliedFilters.platform}>
            <option value="">All platforms</option>
            {platformOptions.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Status</span>
          <select name="status" defaultValue={appliedFilters.status}>
            <option value="Open">Open</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Completed">Completed</option>
            <option value="all">All statuses</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Minimum budget (INR)</span>
          <input
            name="minBudget"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            defaultValue={appliedFilters.minBudget}
            placeholder="0"
          />
        </label>
        <label className="field">
          <span className="field-label">Maximum budget (INR)</span>
          <input
            name="maxBudget"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            defaultValue={appliedFilters.maxBudget}
            placeholder="No maximum"
          />
        </label>
        <label className="field">
          <span className="field-label">Sort by</span>
          <select name="sort" defaultValue={appliedFilters.sort}>
            <option value="newest">Newest first</option>
            <option value="budget_desc">Budget: high to low</option>
            <option value="budget_asc">Budget: low to high</option>
          </select>
        </label>
        <div className="page-actions">
          <button className="btn btn-primary" type="submit">
            Apply filters
          </button>
          <button className="btn btn-secondary" type="button" onClick={resetFilters}>
            Clear
          </button>
        </div>
      </form>

      {loading ? (
        <section className="panel" role="status" aria-live="polite">
          Loading campaigns...
        </section>
      ) : loadError ? (
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
      ) : campaigns.length === 0 ? (
        <section className="panel">
          <p className="empty-note">
            No campaigns match these filters. Try broadening your search or
            clearing the filters.
          </p>
        </section>
      ) : (
        <>
          <section className="panel filter-summary" aria-live="polite">
            Showing {formatNumber(campaigns.length)} of {formatNumber(total)}{" "}
            campaign{total === 1 ? "" : "s"}.
          </section>

          <div className="panel-grid campaign-gallery">
            {campaigns.map((campaign, index) => {
              const isApplying = applyingCampaignIds.has(campaign.campaignId);
              const isFull = campaign.remainingSlots <= 0;
              const hasApplied = campaign.applicationStatus !== null;
              const applicationsClosed =
                campaign.status !== "Open" || !campaign.applicationWindowOpen;
              const canApply =
                campaign.eligible && !applicationsClosed && !isFull;

              return (
                <article
                  className="panel campaign-card"
                  key={campaign.campaignId}
                >
                  <div className="campaign-card-visual" aria-hidden="true">
                    <img
                      src={campaignVisuals[index % campaignVisuals.length]}
                      alt=""
                      loading="lazy"
                    />
                  </div>
                  <div className="campaign-card-content">
                    <div className="page-heading">
                      <div>
                        <span className="page-eyebrow">
                          {campaign.categoryName ?? "Campaign"}
                        </span>
                        <h2>{campaign.campaignName}</h2>
                        <p>{campaign.brandName}</p>
                      </div>
                      <div className="status-stack">
                        <StatusBadge status={campaign.status} />
                        {campaign.applicationStatus ? (
                          <StatusBadge status={campaign.applicationStatus} />
                        ) : null}
                      </div>
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
                          {formatDate(campaign.startDate)} to{" "}
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

                    <section
                      aria-label={`Requirements for ${campaign.campaignName}`}
                    >
                      <h3>Required platforms and deliverables</h3>
                      {campaign.requirements.length === 0 ? (
                        <p>No platform-specific requirements.</p>
                      ) : (
                        <ul>
                          {campaign.requirements.map((requirement) => (
                            <li key={requirement.requirementId}>
                              {requirement.platform ?? "Any platform"}
                              {requirement.minEngagementRate !== null
                                ? ` - at least ${formatPercent(requirement.minEngagementRate)} engagement`
                                : ""}
                              {requirement.requiredNiche
                                ? ` - niche: ${requirement.requiredNiche} (informational)`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="field-hint">
                        Deliverables are assigned by the brand after your
                        application is accepted.
                      </p>
                    </section>

                    {hasApplied &&
                    !applicationSuccesses[campaign.campaignId] ? (
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
                      <ul
                        className="form-error"
                        aria-label="Eligibility requirements"
                      >
                        {campaign.eligibilityReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                    {applicationsClosed && !hasApplied ? (
                      <p className="form-error" role="status">
                        Applications are closed for this campaign.
                      </p>
                    ) : null}
                    {isFull && !hasApplied ? (
                      <p className="form-error" role="status">
                        This campaign has reached its creator limit.
                      </p>
                    ) : null}

                    <div className="page-actions">
                      <Link
                        className="btn btn-secondary"
                        href={`/creator/campaigns/${campaign.campaignId}`}
                      >
                        View campaign
                      </Link>
                      {!hasApplied ? (
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={!canApply || isApplying}
                          onClick={() => void applyToCampaign(campaign)}
                        >
                          {isApplying
                            ? "Applying..."
                            : applicationsClosed
                              ? "Applications closed"
                              : isFull
                                ? "Campaign full"
                                : campaign.eligible
                                  ? "Apply"
                                  : "Not eligible"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <nav className="pagination" aria-label="Campaign pages">
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
        </>
      )}
    </div>
  );
}
