import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Payments",
};

export default function CreatorPaymentsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Creator earnings"
      title="Payments"
      description="Follow paid, pending, and agreed amounts across your collaborations."
      features={[
        "Review payment records by campaign and brand.",
        "See pending and released amounts together.",
        "Reconcile agreed collaboration values with payments.",
      ]}
      note="Detailed payment records and export tools arrive in a later phase. Paid, pending, and agreed totals are available now on your overview dashboard."
    />
  );
}
