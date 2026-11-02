"use client";

import { DashboardError } from "@/components/dashboard/DashboardError";

type CreatorErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function CreatorError({ error, reset }: CreatorErrorProps) {
  return <DashboardError error={error} reset={reset} />;
}
