"use client";

import { DashboardError } from "@/components/dashboard/DashboardError";

type BrandErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function BrandError({ error, reset }: BrandErrorProps) {
  return <DashboardError error={error} reset={reset} />;
}
