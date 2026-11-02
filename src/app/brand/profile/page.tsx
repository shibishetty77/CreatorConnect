import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { BrandProfileForm } from "@/components/profile/BrandProfileForm";
import { requireRole } from "@/lib/auth/guards";
import { initials } from "@/lib/format";
import { getBrandProfile } from "@/lib/repositories/brand-profiles";

export const metadata: Metadata = {
  title: "Brand profile",
};

export default async function BrandProfilePage() {
  const user = await requireRole("Brand");

  if (!user.brandProfile) {
    notFound();
  }

  const profile = await getBrandProfile(user.brandProfile.brandId);

  if (!profile) {
    notFound();
  }

  const location = [profile.city, profile.state].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        eyebrow="Brand profile"
        title="Your brand identity"
        description="Maintain the company and contact details creators rely on when reviewing your campaigns."
      />

      <div className="profile-layout">
        <section className="panel" aria-labelledby="details-heading">
          <div className="panel-header">
            <div>
              <h2 id="details-heading">Brand details</h2>
              <p>These details appear alongside your campaigns.</p>
            </div>
          </div>
          <BrandProfileForm profile={profile} />
        </section>

        <aside className="panel profile-preview" aria-labelledby="preview-heading">
          <div className="panel-header">
            <div>
              <h2 id="preview-heading">Brand preview</h2>
              <p>How your company profile reads at a glance.</p>
            </div>
          </div>

          <div className="profile-preview-card">
            <span className="profile-preview-avatar" aria-hidden="true">
              {initials(profile.brandName)}
            </span>
            <div>
              <strong>{profile.brandName}</strong>
              <span>{profile.industry || "Industry not set"}</span>
            </div>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Location</dt>
              <dd>{location || "Not set"}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{profile.contactNumber || "Not set"}</dd>
            </div>
            <div>
              <dt>Account email</dt>
              <dd>{profile.email}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>@{profile.username}</dd>
            </div>
          </dl>

          <p className="panel-note">
            Brand description and website fields are not part of the current
            MySQL schema. They must not be added without project-owner approval,
            so this phase edits only the existing brand, industry, contact, and
            location columns.
          </p>
        </aside>
      </div>
    </>
  );
}
