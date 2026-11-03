"use client";

import { useState, type FormEvent } from "react";

type PasswordResponse = {
  data?: { updated?: boolean };
  error?: { message?: string; fields?: Record<string, string> };
};

export function PasswordChangeForm() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    if (saving) return;

    setSaving(true);
    setError(null);
    setFields({});
    setSuccess(null);

    try {
      const response = await fetch("/api/creator/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(formData.get("currentPassword") ?? ""),
          newPassword: String(formData.get("newPassword") ?? ""),
          confirmPassword: String(formData.get("confirmPassword") ?? ""),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | PasswordResponse
        | null;

      if (!response.ok || !payload?.data?.updated) {
        if (payload?.error?.fields) {
          setFields(payload.error.fields);
        }

        throw new Error(
          payload?.error?.message ?? "We could not update your password.",
        );
      }

      form.reset();
      setSuccess(
        "Password updated. Your current session remains signed in.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not update your password.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form-stack" onSubmit={(event) => void submit(event)}>
      <div className="panel-header">
        <div>
          <h2>Change password</h2>
          <p>Use at least 8 characters with at least one letter and number.</p>
        </div>
      </div>

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
        <label className="field-label" htmlFor="current-password">
          Current password
        </label>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          maxLength={72}
          required
        />
        {fields.currentPassword ? (
          <span className="form-error">{fields.currentPassword}</span>
        ) : null}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
        {fields.newPassword ? (
          <span className="form-error">{fields.newPassword}</span>
        ) : null}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="confirm-new-password">
          Confirm new password
        </label>
        <input
          id="confirm-new-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
        {fields.confirmPassword ? (
          <span className="form-error">{fields.confirmPassword}</span>
        ) : null}
      </div>

      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
