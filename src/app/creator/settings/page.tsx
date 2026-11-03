import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { PasswordChangeForm } from "@/components/settings/PasswordChangeForm";
import { requireRole } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Creator settings",
};

export default async function CreatorSettingsPage() {
  const user = await requireRole("Creator");

  if (!user.creatorProfile) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Account settings"
        title="Settings"
        description="Review your account identity and update your password."
        actions={
          <Link className="btn btn-secondary" href="/creator/profile">
            Edit profile
          </Link>
        }
      />

      <div className="panel-grid">
        <section className="panel" aria-labelledby="account-heading">
          <div className="panel-header">
            <div>
              <h2 id="account-heading">Account</h2>
              <p>Read-only identity details from your user account.</p>
            </div>
          </div>

          <dl className="campaign-facts">
            <div>
              <dt>Username</dt>
              <dd>{user.username}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user.role}</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </div>
          </dl>

          <div className="page-actions">
            <Link className="btn btn-secondary" href="/creator/profile">
              Profile and social accounts
            </Link>
            <Link className="btn btn-secondary" href="/creator/applications">
              Application history
            </Link>
          </div>
        </section>

        <PasswordChangeForm />

        <section className="panel" aria-labelledby="settings-limits-heading">
          <div className="panel-header">
            <div>
              <h2 id="settings-limits-heading">Settings availability</h2>
              <p>
                The current database schema does not store notification,
                visibility, or availability preferences.
              </p>
            </div>
          </div>

          <ul className="status-list">
            <li>
              <strong>Supported</strong>
              <span>
                Password changes, profile details, and social account details.
              </span>
            </li>
            <li>
              <strong>Not supported</strong>
              <span>
                Email/payment notification preferences, account visibility, and
                creator availability settings. Adding these requires new
                database columns and a migration.
              </span>
            </li>
            <li>
              <strong>Sessions</strong>
              <span>
                Changing your password does not end the current session. Sign out
                on shared devices.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
