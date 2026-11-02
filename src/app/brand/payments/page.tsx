import type { Metadata } from "next";

import { PaymentsWorkspace } from "@/components/finance/PaymentsWorkspace";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Brand payments",
};

export default function BrandPaymentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Sponsorship spend"
        title="Payments"
        description="Review settlement records and payment status for your creator collaborations."
      />
      <PaymentsWorkspace role="brand" />
    </>
  );
}
