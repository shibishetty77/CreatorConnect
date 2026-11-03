"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CampaignApplyButtonProps = {
  campaignId: number;
  canApply: boolean;
  disabledLabel?: string;
};

type ApplicationResponse = {
  data?: { application?: { applicationId: number; status: string } };
  error?: { message?: string; fields?: Record<string, string> };
};

export function CampaignApplyButton({
  campaignId,
  canApply,
  disabledLabel = "Not eligible",
}: CampaignApplyButtonProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function apply() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/creator/campaigns/${campaignId}/applications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | ApplicationResponse
        | null;

      if (!response.ok || !payload?.data?.application) {
        throw new Error(
          payload?.error?.fields?.eligibility ??
            payload?.error?.message ??
            "We could not submit your application. Please try again.",
        );
      }

      setMessage("Your application was submitted successfully.");
      router.refresh();
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : "We could not submit your application. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="form-stack">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}
      <button
        className="btn btn-primary"
        type="button"
        disabled={!canApply || saving}
        onClick={() => void apply()}
      >
        {saving ? "Applying..." : canApply ? "Apply to campaign" : disabledLabel}
      </button>
    </div>
  );
}
