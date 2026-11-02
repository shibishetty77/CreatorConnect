"use client";

import { useEffect } from "react";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="panel error-panel" role="alert">
      <span className="placeholder-kicker">Something went wrong</span>
      <h1>We could not load this workspace.</h1>
      <p>
        Your session is still protected. Retry the request, or sign out and
        sign back in if the problem continues.
      </p>
      <button className="btn btn-primary" type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
