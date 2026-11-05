"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type {
  CollaborationRecord,
  CollaborationRequestOptions,
} from "@/lib/repositories/collaborations";

type CollaborationRequestsProps = {
  role: "creator" | "brand";
};

type RequestWorkspaceData = {
  incoming: CollaborationRecord[];
  outgoing: CollaborationRecord[];
  options: CollaborationRequestOptions;
};

type RequestResponse = {
  data?: RequestWorkspaceData;
  error?: { message: string };
};

type CreateResponse = {
  data?: { request: CollaborationRecord };
  error?: { message: string; fields?: Record<string, string> };
};

type DecisionResponse = {
  data?: { request: CollaborationRecord };
  error?: { message: string };
};

const emptyOptions: CollaborationRequestOptions = {
  campaigns: [],
  creators: [],
  brands: [],
};

const refreshEventName = "collaborations:refresh";

function requestCounterpart(
  collaboration: CollaborationRecord,
  role: "creator" | "brand",
): string {
  return role === "creator"
    ? `${collaboration.brandName} · ${collaboration.campaignName}`
    : `${collaboration.creatorName} · ${collaboration.campaignName}`;
}

export function CollaborationRequests({ role }: CollaborationRequestsProps) {
  const [data, setData] = useState<RequestWorkspaceData>({
    incoming: [],
    outgoing: [],
    options: emptyOptions,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [decidingId, setDecidingId] = useState<number | null>(null);

  const loadRequests = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/collaboration-requests", { signal });
      const payload = (await response.json().catch(() => null)) as
        | RequestResponse
        | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ??
            "We could not load collaboration requests.",
        );
      }

      setData({
        incoming: payload.data.incoming ?? [],
        outgoing: payload.data.outgoing ?? [],
        options: payload.data.options ?? emptyOptions,
      });
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "We could not load collaboration requests.",
        );
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadRequests(controller.signal);
    return () => controller.abort();
  }, [loadRequests, retry]);

  async function decide(
    collaboration: CollaborationRecord,
    decision: "Accepted" | "Rejected",
  ) {
    setDecidingId(collaboration.collaborationId);
    setError(null);
    setNotice(null);

    try {
      const action = decision === "Accepted" ? "accept" : "reject";
      const response = await fetch(
        `/api/collaboration-requests/${collaboration.collaborationId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | DecisionResponse
        | null;

      if (!response.ok || !payload?.data?.request) {
        throw new Error(
          payload?.error?.message ??
            "We could not update this collaboration request.",
        );
      }

      setData((current) => ({
        ...current,
        incoming: current.incoming.filter(
          (request) =>
            request.collaborationId !== collaboration.collaborationId,
        ),
      }));
      setNotice(
        decision === "Accepted"
          ? "Request accepted. The collaboration is now active."
          : "Request declined.",
      );

      if (decision === "Accepted") {
        window.dispatchEvent(new Event(refreshEventName));
      }
    } catch (decisionError) {
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : "We could not update this collaboration request.",
      );
    } finally {
      setDecidingId(null);
    }
  }

  const canCreate =
    data.options.campaigns.length > 0 &&
    (role === "creator" || data.options.creators.length > 0);

  return (
    <>
      <section className="panel collaboration-request-panel">
        <header className="panel-header request-panel-header">
          <div>
            <span className="page-eyebrow">
              {role === "creator" ? "Direct Partnerships" : "Creator Outreach"}
            </span>
            <h2>Collaboration requests</h2>
            <p className="muted-copy">
              {role === "creator"
                ? "Review incoming brand invitations or propose a new collaboration to an existing brand."
                : "Review incoming creator proposals or create a collaboration invitation for a creator."}
            </p>
          </div>
          <div className="request-panel-actions">
            <button
              className="btn btn-secondary"
              type="button"
              disabled={loading}
              onClick={() => setRetry((current) => current + 1)}
            >
              Refresh
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={!canCreate}
              onClick={() => {
                setCreateOpen(true);
                setNotice(null);
              }}
            >
              {role === "creator" ? "+ Propose Collaboration" : "+ Create Collaboration"}
            </button>
          </div>
        </header>

        {!canCreate && !loading ? (
          <p className="empty-note">
            {role === "creator"
              ? "No open campaigns are available for proposals right now."
              : "No open campaigns or registered creators are available for invitations right now."}
          </p>
        ) : null}

        {notice ? (
          <p className="form-success" role="status">
            {notice}
          </p>
        ) : null}

        {error ? (
          <div className="request-error" role="alert">
            <p>{error}</p>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setRetry((current) => current + 1)}
            >
              Try again
            </button>
          </div>
        ) : null}

        {loading ? (
          <p className="empty-note" role="status">
            Loading collaboration requests...
          </p>
        ) : data.incoming.length === 0 ? (
          <p className="empty-note">
            No incoming requests need your response.
          </p>
        ) : (
          <div>
            <div style={{ marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Incoming Requests</h3>
              <span className="status-badge status-warning">{data.incoming.length} pending</span>
            </div>
            <div className="request-list">
              {data.incoming.map((request) => (
                <article
                  className="request-card"
                  key={request.collaborationId}
                >
                  <header className="request-card-header">
                    <div>
                      <h3>{request.title}</h3>
                      <p className="request-meta">
                        {requestCounterpart(request, role)}
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </header>

                  <dl className="request-facts">
                    <div>
                      <dt>Proposed budget</dt>
                      <dd>{formatCurrency(request.agreedAmount)}</dd>
                    </div>
                    <div>
                      <dt>Timeline</dt>
                      <dd>
                        {formatDate(request.startDate)} to{" "}
                        {formatDate(request.endDate)}
                      </dd>
                    </div>
                  </dl>

                  {request.description ? (
                    <p className="request-copy">{request.description}</p>
                  ) : null}

                  <details className="request-details">
                    <summary>View brief & requirements</summary>
                    <dl className="request-brief">
                      <div>
                        <dt>Deliverables</dt>
                        <dd>{request.deliverableDescription}</dd>
                      </div>
                      {request.additionalRequirements ? (
                        <div>
                          <dt>Additional requirements</dt>
                          <dd>{request.additionalRequirements}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </details>

                  <div className="request-actions">
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={decidingId !== null}
                      onClick={() => void decide(request, "Accepted")}
                    >
                      {decidingId === request.collaborationId
                        ? "Accepting..."
                        : "Accept"}
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      disabled={decidingId !== null}
                      onClick={() => void decide(request, "Rejected")}
                    >
                      Decline
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {!loading && data.outgoing.length > 0 ? (
          <div className="request-outgoing" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem" }}>
                {role === "creator" ? "Your Sent Proposals" : "Your Sent Invitations"} ({formatNumber(data.outgoing.length)})
              </h3>
            </div>
            <ul className="request-outgoing-list">
              {data.outgoing.map((request) => (
                <li key={request.collaborationId}>
                  <div>
                    <strong>{request.title}</strong>
                    <span>{requestCounterpart(request, role)}</span>
                  </div>
                  <div className="request-outgoing-meta">
                    <span>{formatCurrency(request.agreedAmount)}</span>
                    <StatusBadge status={request.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {createOpen ? (
        <CreateRequestDialog
          role={role}
          options={data.options}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setNotice(
              role === "creator"
                ? "Collaboration proposal submitted successfully."
                : "Collaboration invitation created successfully.",
            );
            setRetry((current) => current + 1);
          }}
        />
      ) : null}
    </>
  );
}

type CreateRequestDialogProps = {
  role: "creator" | "brand";
  options: CollaborationRequestOptions;
  onClose: () => void;
  onCreated: () => void;
};

function CreateRequestDialog({
  role,
  options,
  onClose,
  onCreated,
}: CreateRequestDialogProps) {
  const [brandId, setBrandId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deliverableDescription, setDeliverableDescription] = useState("");
  const [additionalRequirements, setAdditionalRequirements] = useState("");
  const [agreedAmount, setAgreedAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  // For creator: campaigns filtered by selected brand
  const filteredCampaigns =
    role === "creator"
      ? brandId
        ? options.campaigns.filter((c) => String(c.brandId) === brandId)
        : options.campaigns
      : options.campaigns;

  function handleBrandSelect(selectedBrandId: string) {
    setBrandId(selectedBrandId);
    setCampaignId("");
    const brand = options.brands?.find((b) => String(b.brandId) === selectedBrandId);
    if (brand && !title) {
      setTitle(`${brand.brandName} Collaboration`);
    }
  }

  function selectCampaign(value: string) {
    setCampaignId(value);
    const campaign = options.campaigns.find(
      (option) => String(option.campaignId) === value,
    );

    if (!campaign) {
      return;
    }

    if (!title || title.includes("collaboration") || title.includes("Collaboration")) {
      setTitle(`${campaign.campaignName} Collaboration`);
    }
    if (campaign.startDate && !startDate) {
      setStartDate(campaign.startDate);
    }
    if (campaign.endDate && !endDate) {
      setEndDate(campaign.endDate);
    }
    if (campaign.budget && !agreedAmount) {
      setAgreedAmount(campaign.budget);
    }
    if (role === "creator" && campaign.brandId) {
      setBrandId(String(campaign.brandId));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    if (role === "brand" && !creatorId) {
      setFieldErrors({ creatorId: "Choose a creator for this collaboration." });
      setSaving(false);
      return;
    }

    if (!campaignId) {
      setFieldErrors({ campaignId: "Choose a campaign for this collaboration." });
      setSaving(false);
      return;
    }

    if (role === "creator" && !brandId) {
      setFieldErrors({ brandId: "Choose a brand for this proposal." });
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/collaboration-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.trim() || null,
          deliverableDescription,
          additionalRequirements:
            additionalRequirements.trim() || null,
          agreedAmount,
          startDate,
          endDate,
          campaignId: Number(campaignId),
          brandId: role === "creator" && brandId ? Number(brandId) : null,
          creatorId: role === "brand" && creatorId ? Number(creatorId) : null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | CreateResponse
        | null;

      if (!response.ok || !payload?.data?.request) {
        setFieldErrors(payload?.error?.fields ?? {});
        throw new Error(
          payload?.error?.message ??
            "We could not create this collaboration request.",
        );
      }

      onCreated();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not create this collaboration request.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collaboration-request-title"
      >
        <header className="modal-header">
          <div>
            <span className="page-eyebrow">
              {role === "creator" ? "New Proposal" : "New Invitation"}
            </span>
            <h2 id="collaboration-request-title">
              {role === "creator" ? "Propose Collaboration" : "Create Collaboration"}
            </h2>
            <p className="muted-copy">
              {role === "creator"
                ? "Send a collaboration proposal directly to a brand. Once accepted, it becomes an active collaboration."
                : "Invite a creator to collaborate. Once accepted, it will appear in your active collaborations."}
            </p>
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={saving}
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="request-form-grid">
            {role === "brand" ? (
              <label className="field request-field-wide">
                <span className="field-label">Select Creator *</span>
                <select
                  required
                  value={creatorId}
                  onChange={(event) => setCreatorId(event.target.value)}
                >
                  <option value="">Select a creator from registered creators</option>
                  {options.creators.map((creator) => (
                    <option
                      key={creator.creatorId}
                      value={creator.creatorId}
                    >
                      {creator.creatorName} (@{creator.creatorUsername})
                      {creator.city ? ` · ${creator.city}` : ""}
                    </option>
                  ))}
                </select>
                {fieldErrors.creatorId ? (
                  <span className="field-error">{fieldErrors.creatorId}</span>
                ) : null}
              </label>
            ) : (
              <label className="field request-field-wide">
                <span className="field-label">Select Brand *</span>
                <select
                  required
                  value={brandId}
                  onChange={(event) => handleBrandSelect(event.target.value)}
                >
                  <option value="">Select a registered brand</option>
                  {(options.brands ?? []).map((brand) => (
                    <option
                      key={brand.brandId}
                      value={brand.brandId}
                    >
                      {brand.brandName}
                      {brand.industry ? ` (${brand.industry})` : ""}
                      {brand.city ? ` · ${brand.city}` : ""}
                    </option>
                  ))}
                </select>
                {fieldErrors.brandId ? (
                  <span className="field-error">{fieldErrors.brandId}</span>
                ) : null}
              </label>
            )}

            <label className="field request-field-wide">
              <span className="field-label">
                Related Campaign *
              </span>
              <select
                required
                value={campaignId}
                onChange={(event) => selectCampaign(event.target.value)}
              >
                <option value="">
                  {role === "creator"
                    ? "Select a campaign for this brand"
                    : "Select one of your campaigns"}
                </option>
                {filteredCampaigns.map((campaign) => (
                  <option
                    key={campaign.campaignId}
                    value={campaign.campaignId}
                  >
                    {campaign.campaignName}
                    {role === "creator" ? ` · ${campaign.brandName}` : ""}
                  </option>
                ))}
              </select>
              {fieldErrors.campaignId ? (
                <span className="field-error">{fieldErrors.campaignId}</span>
              ) : null}
            </label>

            <label className="field request-field-wide">
              <span className="field-label">Collaboration Title *</span>
              <input
                required
                minLength={3}
                maxLength={150}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={
                  role === "brand"
                    ? "e.g. Summer Brand Campaign Collaboration"
                    : "e.g. Product Showcase & Review Collaboration"
                }
              />
              {fieldErrors.title ? (
                <span className="field-error">{fieldErrors.title}</span>
              ) : null}
            </label>

            <label className="field request-field-wide">
              <span className="field-label">
                {role === "creator" ? "Proposal Description" : "Collaboration Description"}
              </span>
              <textarea
                rows={3}
                maxLength={4000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={
                  role === "brand"
                    ? "Describe the collaboration goals, context, and expectations..."
                    : "Describe your proposal, creative concept, and audience fit..."
                }
              />
              {fieldErrors.description ? (
                <span className="field-error">{fieldErrors.description}</span>
              ) : null}
            </label>

            <label className="field request-field-wide">
              <span className="field-label">Deliverable Description *</span>
              <textarea
                required
                rows={3}
                minLength={10}
                maxLength={4000}
                value={deliverableDescription}
                onChange={(event) =>
                  setDeliverableDescription(event.target.value)
                }
                placeholder="List the content, formats, and quantity expected (e.g. 1 60-second Instagram Reel, 3 story posts)."
              />
              {fieldErrors.deliverableDescription ? (
                <span className="field-error">
                  {fieldErrors.deliverableDescription}
                </span>
              ) : null}
            </label>

            <label className="field request-field-wide">
              <span className="field-label">Additional Requirements</span>
              <textarea
                rows={2}
                maxLength={4000}
                value={additionalRequirements}
                onChange={(event) =>
                  setAdditionalRequirements(event.target.value)
                }
                placeholder="Usage rights, approval timelines, hashtag rules, or other conditions."
              />
              {fieldErrors.additionalRequirements ? (
                <span className="field-error">
                  {fieldErrors.additionalRequirements}
                </span>
              ) : null}
            </label>

            <label className="field">
              <span className="field-label">
                {role === "creator" ? "Suggested Budget *" : "Proposed Budget *"}
              </span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={agreedAmount}
                onChange={(event) => setAgreedAmount(event.target.value)}
                placeholder="0.00"
              />
              {fieldErrors.agreedAmount ? (
                <span className="field-error">{fieldErrors.agreedAmount}</span>
              ) : null}
            </label>

            <label className="field">
              <span className="field-label">Start Date *</span>
              <input
                required
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
              {fieldErrors.startDate ? (
                <span className="field-error">{fieldErrors.startDate}</span>
              ) : null}
            </label>

            <label className="field">
              <span className="field-label">End Date / Deadline *</span>
              <input
                required
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
              {fieldErrors.endDate ? (
                <span className="field-error">{fieldErrors.endDate}</span>
              ) : null}
            </label>
          </div>

          <div className="page-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Submitting..."
                : role === "creator"
                  ? "Send Proposal"
                  : "Send Invitation"}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
