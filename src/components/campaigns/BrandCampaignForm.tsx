"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import type {
  BrandCampaignRecord,
  CampaignCategoryOption,
} from "@/lib/repositories/brand-campaigns";

type CampaignResponse = {
  data?: { campaignId: number };
  error?: { message?: string; fields?: Record<string, string> };
};

type BrandCampaignFormProps = {
  categories: CampaignCategoryOption[];
  campaign?: BrandCampaignRecord;
  onCancel?: () => void;
  onSaved?: () => void;
};

export function BrandCampaignForm({
  categories,
  campaign,
  onCancel,
  onSaved,
}: BrandCampaignFormProps) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const isEditing = Boolean(campaign);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    inFlight.current = true;
    setBusy(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const body: Record<string, FormDataEntryValue | null> = Object.fromEntries(
      formData.entries(),
    );
    if (!body.categoryId) body.categoryId = null;
    if (isEditing) {
      if (!String(body.description ?? "").trim()) body.description = null;
      for (const field of [
        "budget",
        "minFollowers",
        "creatorLimit",
        "startDate",
        "endDate",
      ]) {
        if (!String(body[field] ?? "").trim()) delete body[field];
      }
    }

    try {
      const response = await fetch(
        isEditing
          ? `/api/brand/campaigns/${campaign!.campaignId}`
          : "/api/brand/campaigns",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | CampaignResponse
        | null;
      if (!response.ok || !payload?.data) {
        setFieldErrors(payload?.error?.fields ?? {});
        throw new Error(
          payload?.error?.message ??
            `We could not ${isEditing ? "save" : "create"} the campaign.`,
        );
      }

      if (isEditing) {
        onSaved?.();
      } else {
        setSuccess(true);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not save the campaign. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (success) {
    return (
      <section className="panel success-panel" role="status">
        <h2>Campaign created</h2>
        <p>Your campaign is now saved and available in your campaign list.</p>
        <Link className="btn btn-primary" href="/brand/campaigns">
          View my campaigns
        </Link>
      </section>
    );
  }

  return (
    <form className="social-form brand-campaign-form" onSubmit={submit}>
      {error ? (
        <p className="error-panel" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-grid-two">
        <label className="field">
          <span>Campaign title</span>
          <input
            name="campaignName"
            required
            minLength={3}
            maxLength={150}
            defaultValue={campaign?.campaignName ?? ""}
            aria-invalid={Boolean(fieldErrors.campaignName)}
          />
          {fieldErrors.campaignName ? (
            <small role="alert">{fieldErrors.campaignName}</small>
          ) : null}
        </label>
        <label className="field">
          <span>Campaign category</span>
          <select
            name="categoryId"
            defaultValue={campaign?.categoryId?.toString() ?? ""}
            aria-invalid={Boolean(fieldErrors.categoryId)}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option
                key={category.categoryId}
                value={category.categoryId}
              >
                {category.categoryName}
              </option>
            ))}
          </select>
          {fieldErrors.categoryId ? (
            <small role="alert">{fieldErrors.categoryId}</small>
          ) : null}
        </label>
      </div>
      <label className="field">
        <span>Description</span>
        <textarea
          name="description"
          rows={4}
          maxLength={4000}
          defaultValue={campaign?.description ?? ""}
          aria-invalid={Boolean(fieldErrors.description)}
        />
        {fieldErrors.description ? (
          <small role="alert">{fieldErrors.description}</small>
        ) : null}
      </label>
      <div className="form-grid-two">
        <label className="field">
          <span>Budget (INR)</span>
          <input
            name="budget"
            type="number"
            min="0.01"
            max="9999999999.99"
            step="0.01"
            required={!isEditing}
            defaultValue={campaign?.budget ?? ""}
            aria-invalid={Boolean(fieldErrors.budget)}
          />
          {fieldErrors.budget ? (
            <small role="alert">{fieldErrors.budget}</small>
          ) : null}
        </label>
        <label className="field">
          <span>Minimum creator followers</span>
          <input
            name="minFollowers"
            type="number"
            min="0"
            step="1"
            required={!isEditing}
            defaultValue={campaign?.minFollowers ?? 0}
            aria-invalid={Boolean(fieldErrors.minFollowers)}
          />
          {fieldErrors.minFollowers ? (
            <small role="alert">{fieldErrors.minFollowers}</small>
          ) : null}
        </label>
        <label className="field">
          <span>Maximum accepted creators</span>
          <input
            name="creatorLimit"
            type="number"
            min="1"
            max="100"
            step="1"
            required={!isEditing}
            defaultValue={campaign?.creatorLimit ?? 1}
            aria-invalid={Boolean(fieldErrors.creatorLimit)}
          />
          {fieldErrors.creatorLimit ? (
            <small role="alert">{fieldErrors.creatorLimit}</small>
          ) : null}
        </label>
      </div>
      <div className="form-grid-two">
        <label className="field">
          <span>Start date</span>
          <input
            name="startDate"
            type="date"
            required={!isEditing}
            defaultValue={campaign?.startDate.slice(0, 10) ?? ""}
            aria-invalid={Boolean(fieldErrors.startDate)}
          />
          {fieldErrors.startDate ? (
            <small role="alert">{fieldErrors.startDate}</small>
          ) : null}
        </label>
        <label className="field">
          <span>End date</span>
          <input
            name="endDate"
            type="date"
            required={!isEditing}
            defaultValue={campaign?.endDate.slice(0, 10) ?? ""}
            aria-invalid={Boolean(fieldErrors.endDate)}
          />
          {fieldErrors.endDate ? (
            <small role="alert">{fieldErrors.endDate}</small>
          ) : null}
        </label>
      </div>
      {!isEditing ? (
        <p className="panel-note">
          Creators can apply and collaboration invitations can use this
          campaign while it is Open and today falls within its date range.
        </p>
      ) : null}
      {campaign ? (
        <label className="field">
          <span>Campaign status</span>
          <select name="status" defaultValue={campaign.status}>
            <option value="Open">Open</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Completed">Completed</option>
          </select>
        </label>
      ) : null}
      <div className="form-actions">
        {onCancel ? (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        ) : (
          <Link className="btn btn-secondary" href="/brand/campaigns">
            Cancel
          </Link>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : isEditing ? "Save changes" : "Create campaign"}
        </button>
      </div>
    </form>
  );
}
