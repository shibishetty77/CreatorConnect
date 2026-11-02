import type { Metadata } from "next";

import { PaymentsWorkspace } from "@/components/finance/PaymentsWorkspace";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Payments",
};

export default function CreatorPaymentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Creator earnings"
        title="Payments"
        description="Review payment status and settlement dates across your collaborations."
      />
      <PaymentsWorkspace role="creator" />
    </>
  );
}
