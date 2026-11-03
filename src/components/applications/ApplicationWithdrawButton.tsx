"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApplicationWithdrawButtonProps = {
  applicationId: number;
  campaignName: string;
  small?: boolean;
};

type WithdrawResponse = {
  data?: { withdrawn?: boolean };
  error?: { message?: string };
};

export function ApplicationWithdrawButton({
  applicationId,
  campaignName,
  small = true,
}: ApplicationWithdrawButtonProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    if (saving) return;

    if (
      !window.confirm(
        `Withdraw your pending application to "${campaignName}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/creator/applications/${applicationId}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => null)) as
        | WithdrawResponse
        | null;

      if (!response.ok || !payload?.data?.withdrawn) {
        throw new Error(
          payload?.error?.message ??
            "We could not withdraw this application. Please try again.",
        );
      }

      router.refresh();
    } catch (withdrawError) {
      setError(
        withdrawError instanceof Error
          ? withdrawError.message
          : "We could not withdraw this application. Please try again.",
      );
      setSaving(false);
    }
  }

  return (
    <span className="withdraw-action">
      <button
        className={`btn btn-danger${small ? " btn-small" : ""}`}
        type="button"
        disabled={saving}
        onClick={() => void withdraw()}
      >
        {saving ? "Withdrawing..." : "Withdraw"}
      </button>
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
