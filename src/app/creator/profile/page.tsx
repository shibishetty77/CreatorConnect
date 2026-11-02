import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { CreatorProfileForm } from "@/components/profile/CreatorProfileForm";
import { SocialAccountsManager } from "@/components/profile/SocialAccountsManager";
import { requireRole } from "@/lib/auth/guards";
import { formatNumber, initials } from "@/lib/format";
import {
  getCreatorProfile,
  listSocialAccounts,
} from "@/lib/repositories/creator-profiles";

export const metadata: Metadata = {
  title: "Creator profile",
};

export default async function CreatorProfilePage() {
  const user = await requireRole("Creator");

  if (!user.creatorProfile) {
    notFound();
  }

  const [profile, socialAccounts] = await Promise.all([
    getCreatorProfile(user.creatorProfile.creatorId),
    listSocialAccounts(user.creatorProfile.creatorId),
  ]);

  if (!profile) {
    notFound();
  }

  const name = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(" ");
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const totalFollowers = socialAccounts.reduce(
    (sum, account) => sum + account.followers,
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Creator profile"
        title="Your public creator identity"
        description="Keep your details and social reach current so brands can evaluate fit quickly."
      />

      <div className="profile-layout">
        <section className="panel" aria-labelledby="details-heading">
          <div className="panel-header">
            <div>
              <h2 id="details-heading">Profile details</h2>
              <p>These details are visible to brand teams reviewing your work.</p>
            </div>
          </div>
          <CreatorProfileForm profile={profile} />
        </section>

        <aside className="panel profile-preview" aria-labelledby="preview-heading">
          <div className="panel-header">
            <div>
              <h2 id="preview-heading">Profile preview</h2>
              <p>How your account reads at a glance.</p>
            </div>
          </div>

          <div className="profile-preview-card">
            <span className="profile-preview-avatar" aria-hidden="true">
              {initials(name)}
            </span>
            <div>
              <strong>{name}</strong>
              <span>@{profile.username}</span>
            </div>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Location</dt>
              <dd>{location || "Not set"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{profile.phone || "Not set"}</dd>
            </div>
            <div>
              <dt>Social reach</dt>
              <dd>
                {formatNumber(totalFollowers)} followers across{" "}
                {socialAccounts.length} accounts
              </dd>
            </div>
            <div>
              <dt>Bio</dt>
              <dd>{profile.bio || "Add a short bio for brand teams."}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <SocialAccountsManager initialAccounts={socialAccounts} />
    </>
  );
}
