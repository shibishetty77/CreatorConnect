import type { Metadata } from "next";
import Link from "next/link";

import { dashboardForRole } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Access denied",
};

export default async function ForbiddenPage() {
  const user = await getCurrentUser();

  return (
    <main className="forbidden-page" id="main-content">
      <section className="forbidden-card" aria-labelledby="forbidden-heading">
        <span className="forbidden-code" aria-hidden="true">
          403
        </span>
        <h1 id="forbidden-heading">Access denied</h1>
        <p>
          Your account does not have permission to open this workspace. If you
          believe this is a mistake, contact a platform administrator.
        </p>
        <div className="forbidden-actions">
          {user ? (
            <Link
              className="btn btn-primary"
              href={dashboardForRole(user.role)}
            >
              Go to my dashboard
            </Link>
          ) : (
            <Link className="btn btn-primary" href="/login">
              Sign in
            </Link>
          )}
          <Link className="btn btn-secondary" href="/">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
