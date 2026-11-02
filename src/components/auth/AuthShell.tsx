import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
};

const FEATURES = [
  "Role-specific dashboards for creators, brands, and admins",
  "Secure, server-verified sessions on every request",
  "Password and profile data kept out of the browser",
];

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="auth-page">
      <aside className="auth-showcase" aria-label="CreatorConnect overview">
        <Link className="brand-lockup brand-lockup-inverse" href="/">
          <span className="brand-mark">CC</span>
          <span>CreatorConnect</span>
        </Link>

        <div className="showcase-copy">
          <p className="showcase-eyebrow">Creator &amp; brand partnerships</p>
          <h2>One workspace for every collaboration.</h2>
          <p>
            From the first campaign brief to the final payment, keep creators
            and brands aligned in a secure, role-aware platform.
          </p>
          <ul className="feature-list">
            {FEATURES.map((feature) => (
              <li key={feature}>
                <span className="feature-check" aria-hidden="true">
                  &#10003;
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="showcase-note">
          Access is protected with HttpOnly sessions and server-side role
          checks.
        </p>
      </aside>

      <main className="auth-main" id="main-content">
        <div className="auth-mobile-brand">
          <Link className="brand-lockup" href="/">
            <span className="brand-mark">CC</span>
            <span>CreatorConnect</span>
          </Link>
        </div>
        <div className="auth-card">{children}</div>
        <p className="auth-legal">
          By continuing, you agree to keep account credentials private and use
          the platform responsibly.
        </p>
      </main>
    </div>
  );
}
