"use client";

import { DashboardError } from "@/components/dashboard/DashboardError";

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: AdminErrorProps) {
  return <DashboardError error={error} reset={reset} />;
}
