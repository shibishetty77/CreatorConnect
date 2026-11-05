"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { BrandCampaignForm } from "@/components/campaigns/BrandCampaignForm";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type {
  BrandCampaignRecord,
  CampaignCategoryOption,
} from "@/lib/repositories/brand-campaigns";

type CampaignsResponse = {
  data?: {
    campaigns: BrandCampaignRecord[];
    categories: CampaignCategoryOption[];
  };
  error?: { message?: string };
};

export function BrandCampaigns() {
  const [campaigns, setCampaigns] = useState<BrandCampaignRecord[]>([]);
  const [categories, setCategories] = useState<CampaignCategoryOption[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/brand/campaigns", {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | CampaignsResponse
          | null;
        if (
          !response.ok ||
          !Array.isArray(payload?.data?.campaigns) ||
          !Array.isArray(payload.data.categories)
        ) {
          throw new Error(
            payload?.error?.message ?? "We could not load campaigns.",
          );
        }
        setCampaigns(payload.data.campaigns);
        setCategories(payload.data.categories);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "We could not load campaigns.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [retry]);

  return (
    <section className="brand-campaigns-workspace">
      {loading ? (
        <div className="panel" role="status">
          Loading your campaigns…
        </div>
      ) : error ? (
        <div className="panel error-panel" role="alert">
          <h2>Campaigns could not be loaded</h2>
          <p>{error}</p>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="panel empty-campaigns">
          <h2>Start with your first campaign</h2>
          <p>
            Create a campaign to publish a brief, receive creator applications,
            and connect it to collaboration and delivery workflows.
          </p>
          <Link className="btn btn-primary" href="/brand/campaigns/new">
            + Create Campaign
          </Link>
        </div>
      ) : (
        <>
          <div className="campaigns-toolbar">
            <p>
              {formatNumber(campaigns.length)} campaign
              {campaigns.length === 1 ? "" : "s"} owned by your brand
            </p>
            <Link className="btn btn-primary" href="/brand/campaigns/new">
              + Create Campaign
            </Link>
          </div>
          <div className="brand-campaign-grid">
            {campaigns.map((campaign) => (
              <article className="panel brand-campaign-card" key={campaign.campaignId}>
                <div className="brand-campaign-card-heading">
                  <div>
                    <span className="page-eyebrow">
                      {campaign.categoryName ?? "Uncategorized"}
                    </span>
                    <h2>{campaign.campaignName}</h2>
                  </div>
                  <StatusBadge status={campaign.status} />
                </div>
                <p className="brand-campaign-description">
                  {campaign.description || "No campaign description provided."}
                </p>
                <dl className="campaign-facts">
                  <div>
                    <dt>Budget</dt>
                    <dd>{formatCurrency(campaign.budget)}</dd>
                  </div>
                  <div>
                    <dt>Dates</dt>
                    <dd>
                      {formatDate(campaign.startDate)} –{" "}
                      {formatDate(campaign.endDate)}
                    </dd>
                  </div>
                  <div>
                    <dt>Applications</dt>
                    <dd>
                      {formatNumber(campaign.applicationCount)} total ·{" "}
                      {formatNumber(campaign.pendingApplicationCount)} pending
                    </dd>
                  </div>
                  <div>
                    <dt>Accepted creators</dt>
                    <dd>
                      {formatNumber(campaign.acceptedApplicationCount)} /{" "}
                      {formatNumber(campaign.creatorLimit)}
                    </dd>
                  </div>
                </dl>
                {editing === campaign.campaignId ? (
                  <div className="brand-campaign-edit">
                    <h3>Edit campaign</h3>
                    <BrandCampaignForm
                      campaign={campaign}
                      categories={categories}
                      onCancel={() => setEditing(null)}
                      onSaved={() => {
                        setEditing(null);
                        setRetry((value) => value + 1);
                      }}
                    />
                  </div>
                ) : (
                  <div className="brand-campaign-actions">
                    <Link
                      className="btn btn-secondary"
                      href="/brand/applications"
                    >
                      Review applications
                    </Link>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => setEditing(campaign.campaignId)}
                    >
                      Edit / manage status
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
