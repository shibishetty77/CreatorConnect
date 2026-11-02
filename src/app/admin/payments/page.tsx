import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Admin payments",
};

export default function AdminPaymentsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Payment oversight"
      title="Payments"
      description="Monitor released and pending payments across every collaboration."
      features={[
        "Review payment records by brand, creator, and campaign.",
        "Compare paid and pending values against agreements.",
        "Investigate failed or disputed payment records.",
      ]}
      note="Payment administration is read-only in Phase 4. Total paid value and payment totals are available on the overview dashboard."
    />
  );
}
