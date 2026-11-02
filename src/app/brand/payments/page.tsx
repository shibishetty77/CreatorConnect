import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/dashboard/SectionPlaceholder";

export const metadata: Metadata = {
  title: "Brand payments",
};

export default function BrandPaymentsPage() {
  return (
    <SectionPlaceholder
      eyebrow="Sponsorship spend"
      title="Payments"
      description="Track paid and pending creator payments against campaign budgets."
      features={[
        "Review payment records by creator and campaign.",
        "See paid and pending amounts together.",
        "Reconcile sponsorship spend with campaign budgets.",
      ]}
      note="Detailed payment workflows arrive in a later phase. Paid, pending, and budget totals are available now on the overview dashboard."
    />
  );
}
