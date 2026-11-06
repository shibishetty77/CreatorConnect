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
        <section className="studio-hero">
          <div className="studio-copy">
            <span className="studio-kicker">A home for creative partnerships</span>
            <h1>
              Where Creators Meet Their{" "}
              <span>Next Big Collaboration.</span>
            </h1>
            <p className="studio-lede">
              A more considered way to discover campaigns, build brand
              relationships, and bring your best work into the world.
            </p>
            <div className="studio-actions">
              <Link className="btn btn-primary" href="/register">
                Find your next collaboration
              </Link>
              <Link className="btn btn-secondary" href="/login">
                Sign in
              </Link>
            </div>
            <p className="studio-footnote">
              Thoughtful tools for creators, brands, and the teams behind them.
            </p>
          </div>

          <div className="studio-art" aria-label="Creative campaign photography">
            <div className="studio-photo studio-photo-main">
              <img
                src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=85"
                alt="Creator portrait in warm natural light"
                fetchPriority="high"
              />
            </div>
            <div className="studio-photo studio-photo-detail">
              <img
                src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=85"
                alt="Editorial fashion portrait"
                loading="lazy"
              />
            </div>
            <span className="viewfinder" aria-hidden="true" />
            <span className="studio-stamp" aria-hidden="true" />
            <div className="studio-caption">
              <small>Made for what comes next</small>
              <strong>Good work finds its people.</strong>
              <p>Campaigns, conversations, and creative work in one place.</p>
            </div>
            <span className="studio-lens-label" aria-hidden="true">
              CreatorConnect · Studio no. 01
            </span>
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
      <footer className="studio-bottom">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">CC</span>
          <span>CreatorConnect</span>
        </Link>
        <span>One creative workspace. Every collaboration.</span>
      </footer>
    </div>
  );
}
