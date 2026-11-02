"use client";

import { useRef, useState, type FormEvent } from "react";

import { formatNumber, formatPercent } from "@/lib/format";
import type { SocialAccountRecord } from "@/lib/repositories/creator-profiles";
import { zodFieldErrors } from "@/lib/validations/auth";
import {
  socialAccountSchema,
  socialPlatforms,
} from "@/lib/validations/profiles";

type SocialAccountsManagerProps = {
  initialAccounts: SocialAccountRecord[];
};

type FormValues = {
  platform: string;
  username: string;
  followers: string;
  engagementRate: string;
  accountUrl: string;
};

type ApiErrorBody = {
  error?: {
    message?: string;
    fields?: Record<string, string>;
  };
};

const emptyForm: FormValues = {
  platform: "Instagram",
  username: "",
  followers: "",
  engagementRate: "",
  accountUrl: "",
};

function valuesFromAccount(account: SocialAccountRecord): FormValues {
  return {
    platform: account.platform,
    username: account.username,
    followers: String(account.followers),
    engagementRate: account.engagementRate,
    accountUrl: account.accountUrl ?? "",
  };
}

function sortAccounts(accounts: SocialAccountRecord[]) {
  return [...accounts].sort(
    (a, b) => b.followers - a.followers || a.accountId - b.accountId,
  );
}

export function SocialAccountsManager({
  initialAccounts,
}: SocialAccountsManagerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [accounts, setAccounts] = useState(() =>
    sortAccounts(initialAccounts),
  );
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!(field in current)) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function openCreateForm() {
    setEditingId(null);
    setValues(emptyForm);
    setFieldErrors({});
    setError(null);
    setMessage(null);
    setFormOpen(true);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 0);
  }

  function openEditForm(account: SocialAccountRecord) {
    setEditingId(account.accountId);
    setValues(valuesFromAccount(account));
    setFieldErrors({});
    setError(null);
    setMessage(null);
    setFormOpen(true);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 0);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setValues(emptyForm);
    setFieldErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setFieldErrors({});

    const parsed = socialAccountSchema.safeParse(values);

    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      setError("Please correct the highlighted fields.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        editingId
          ? `/api/creator/social-accounts/${editingId}`
          : "/api/creator/social-accounts",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | (ApiErrorBody & { data?: { account?: SocialAccountRecord } })
        | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fields ?? {});
        setError(body?.error?.message ?? "We could not save this account.");
        return;
      }

      const account = body?.data?.account;

      if (!account) {
        setError("The server did not return the saved account.");
        return;
      }

      setAccounts((current) =>
        sortAccounts(
          editingId
            ? current.map((item) =>
                item.accountId === editingId ? account : item,
              )
            : [...current, account],
        ),
      );
      setMessage(
        editingId
          ? "Social account updated."
          : "Social account added.",
      );
      closeForm();
    } catch {
      setError("We could not reach the server. Check your connection and retry.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(account: SocialAccountRecord) {
    const confirmed = window.confirm(
      `Remove @${account.username} from your social accounts?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(account.accountId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/creator/social-accounts/${account.accountId}`,
        { method: "DELETE" },
      );
      const body = (await response.json().catch(() => null)) as
        | ApiErrorBody
        | null;

      if (!response.ok) {
        setError(body?.error?.message ?? "We could not remove this account.");
        return;
      }

      setAccounts((current) =>
        current.filter((item) => item.accountId !== account.accountId),
      );
      setMessage("Social account removed.");
    } catch {
      setError("We could not reach the server. Check your connection and retry.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section
      className="panel social-accounts-panel"
      id="social-accounts"
      aria-labelledby="social-accounts-heading"
    >
      <div className="panel-header">
        <div>
          <h2 id="social-accounts-heading">Social accounts</h2>
          <p>Connect the channels brands should use to evaluate your reach.</p>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={openCreateForm}
        >
          Add account
        </button>
      </div>

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

      {accounts.length === 0 ? (
        <p className="empty-note">
          No social accounts yet. Add your first channel to show brands where
          you publish.
        </p>
      ) : (
        <ul className="social-account-list">
          {accounts.map((account) => (
            <li className="social-account-card" key={account.accountId}>
              <div className="social-account-main">
                <span className="platform-pill">{account.platform}</span>
                <div>
                  <strong>@{account.username}</strong>
                  {account.accountUrl ? (
                    <a
                      href={account.accountUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      View profile
                    </a>
                  ) : (
                    <span className="table-subtext">No profile URL</span>
                  )}
                </div>
              </div>
              <dl className="social-account-stats">
                <div>
                  <dt>Followers</dt>
                  <dd>{formatNumber(account.followers)}</dd>
                </div>
                <div>
                  <dt>Engagement</dt>
                  <dd>{formatPercent(account.engagementRate)}</dd>
                </div>
              </dl>
              <div className="social-account-actions">
                <button
                  className="btn btn-quiet"
                  type="button"
                  onClick={() => openEditForm(account)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger-quiet"
                  type="button"
                  onClick={() => handleDelete(account)}
                  disabled={deletingId === account.accountId}
                  aria-busy={deletingId === account.accountId}
                >
                  {deletingId === account.accountId ? "Removing..." : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen ? (
        <form className="social-form" onSubmit={handleSubmit} ref={formRef}>
          <div className="social-form-heading">
            <div>
              <h3>
                {editingId ? "Edit social account" : "Add a social account"}
              </h3>
              <p>
                Followers and engagement are submitted as snapshot metrics.
              </p>
            </div>
          </div>

          <div className="form-grid-two">
            <div className="field">
              <label htmlFor="social-platform">Platform</label>
              <select
                id="social-platform"
                name="platform"
                value={values.platform}
                onChange={(event) =>
                  updateValue("platform", event.target.value)
                }
                aria-invalid={Boolean(fieldErrors.platform)}
                aria-describedby={
                  fieldErrors.platform ? "social-platform-error" : undefined
                }
                required
              >
                {socialPlatforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
              {fieldErrors.platform ? (
                <span className="field-error" id="social-platform-error">
                  {fieldErrors.platform}
                </span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="social-username">Account username</label>
              <input
                id="social-username"
                name="username"
                value={values.username}
                onChange={(event) =>
                  updateValue("username", event.target.value)
                }
                maxLength={100}
                placeholder="yourhandle"
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={
                  fieldErrors.username ? "social-username-error" : undefined
                }
                required
              />
              {fieldErrors.username ? (
                <span className="field-error" id="social-username-error">
                  {fieldErrors.username}
                </span>
              ) : null}
            </div>
          </div>

          <div className="form-grid-two">
            <div className="field">
              <label htmlFor="social-followers">Followers</label>
              <input
                id="social-followers"
                name="followers"
                type="number"
                min="0"
                step="1"
                value={values.followers}
                onChange={(event) =>
                  updateValue("followers", event.target.value)
                }
                placeholder="125000"
                aria-invalid={Boolean(fieldErrors.followers)}
                aria-describedby={
                  fieldErrors.followers ? "social-followers-error" : undefined
                }
                required
              />
              {fieldErrors.followers ? (
                <span className="field-error" id="social-followers-error">
                  {fieldErrors.followers}
                </span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="social-engagement">Engagement rate (%)</label>
              <input
                id="social-engagement"
                name="engagementRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={values.engagementRate}
                onChange={(event) =>
                  updateValue("engagementRate", event.target.value)
                }
                placeholder="4.25"
                aria-invalid={Boolean(fieldErrors.engagementRate)}
                aria-describedby={
                  fieldErrors.engagementRate
                    ? "social-engagement-error"
                    : undefined
                }
                required
              />
              {fieldErrors.engagementRate ? (
                <span className="field-error" id="social-engagement-error">
                  {fieldErrors.engagementRate}
                </span>
              ) : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="social-url">Profile URL</label>
            <input
              id="social-url"
              name="accountUrl"
              type="url"
              value={values.accountUrl}
              onChange={(event) =>
                updateValue("accountUrl", event.target.value)
              }
              maxLength={255}
              placeholder="https://instagram.com/yourhandle"
              aria-invalid={Boolean(fieldErrors.accountUrl)}
              aria-describedby={
                fieldErrors.accountUrl ? "social-url-error" : undefined
              }
            />
            {fieldErrors.accountUrl ? (
              <span className="field-error" id="social-url-error">
                {fieldErrors.accountUrl}
              </span>
            ) : null}
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : editingId
                  ? "Save account"
                  : "Add account"}
            </button>
            <button
              className="btn btn-quiet"
              type="button"
              onClick={closeForm}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
