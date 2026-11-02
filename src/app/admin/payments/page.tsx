import type { Metadata } from "next";

import { PaymentsWorkspace } from "@/components/finance/PaymentsWorkspace";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Admin payments",
};

export default function AdminPaymentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Payment oversight"
        title="Payments"
        description="Review and correct pending payment records across collaborations."
      />
      <PaymentsWorkspace role="admin" />
    </>
  );
}
