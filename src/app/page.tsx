import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/guards";
import { dashboardForRole } from "@/lib/auth/constants";

function RoleIcon({ name }: { name: "creator" | "brand" | "admin" }) {
  if (name === "creator") {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.7-3.4 3.3-5.5 7-5.5s6.3 2.1 7 5.5" />
      </svg>
    );
  }

  if (name === "brand") {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 20V7.5L12 3l8 4.5V20" />
        <path d="M9 20v-5h6v5M8 9h.01M12 9h.01M16 9h.01" />
      </svg>
    );
  }

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l7 3v5c0 4.4-2.8 7.5-7 9-4.2-1.5-7-4.6-7-9V6l7-3Z" />
      <path d="M9.5 12l1.8 1.8 3.4-3.6" />
    </svg>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const dashboardHref = user ? dashboardForRole(user.role) : null;

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">CC</span>
          <span>CreatorConnect</span>
        </Link>

        <nav className="landing-nav-actions" aria-label="Account">
          {dashboardHref ? (
            <Link className="btn btn-primary" href={dashboardHref}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link className="btn btn-ghost" href="/login">
                Sign in
              </Link>
              <Link className="btn btn-primary" href="/register">
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <main id="main-content">
        <section className="landing-hero">
          <div>
            <span className="landing-badge">Trusted collaboration workspace</span>
            <h1>
              Partnerships that move <span>at creator speed.</span>
            </h1>
            <p className="landing-lede">
              CreatorConnect brings creators and brands into one secure
              workspace for campaigns, deliverables, contracts, and payments.
              Sign in to the dashboard built for your role.
            </p>
            <div className="landing-actions">
              <Link className="btn btn-primary" href="/register">
                Get started
              </Link>
              <Link className="btn btn-secondary" href="/login">
                Sign in to your account
              </Link>
            </div>
            <p className="landing-note">
              Role-based access keeps creator, brand, and admin workspaces
              separate.
            </p>
          </div>

          <div className="landing-visual" aria-hidden="true">
            <div className="landing-orbit" />
            <div className="landing-preview">
              <div className="landing-preview-head">
                <div>
                  <div className="landing-preview-label">Workspace</div>
                  <h2>Campaign overview</h2>
                </div>
                <span className="role-badge">Live</span>
              </div>

              <div className="landing-preview-grid">
                <div className="landing-preview-card">
                  <strong>259</strong>
                  <span>Seed records verified</span>
                </div>
                <div className="landing-preview-card">
                  <strong>15</strong>
                  <span>Connected data tables</span>
                </div>
              </div>

              <div className="landing-preview-list">
                <div className="landing-preview-row">
                  <span className="landing-preview-dot" />
                  <span>Fashion campaign</span>
                  <span>In review</span>
                </div>
                <div className="landing-preview-row">
                  <span className="landing-preview-dot" />
                  <span>Creator payment</span>
                  <span>Scheduled</span>
                </div>
                <div className="landing-preview-row">
                  <span className="landing-preview-dot" />
                  <span>Travel collaboration</span>
                  <span>Completed</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-roles" aria-label="Workspace roles">
          <article className="landing-role-card">
            <span className="landing-role-icon">
              <RoleIcon name="creator" />
            </span>
            <h2>For creators</h2>
            <p>
              Discover brand campaigns, manage deliverables, and keep every
              collaboration in one place.
            </p>
          </article>
          <article className="landing-role-card">
            <span className="landing-role-icon">
              <RoleIcon name="brand" />
            </span>
            <h2>For brands</h2>
            <p>
              Run creator campaigns, review submissions, and coordinate
              contracts and payments with clarity.
            </p>
          </article>
          <article className="landing-role-card">
            <span className="landing-role-icon">
              <RoleIcon name="admin" />
            </span>
            <h2>For administrators</h2>
            <p>
              Maintain platform oversight with protected access that is never
              available through public registration.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
