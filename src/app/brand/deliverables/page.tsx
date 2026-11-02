import type { Metadata } from "next";

import { DeliveryWorkspace } from "@/components/delivery/DeliveryWorkspace";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Brand deliverables",
};

export default function BrandDeliverablesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Content review"
        title="Deliverables"
        description="Create delivery milestones, review creator submissions, and track completion."
      />
      <DeliveryWorkspace role="brand" />
    </>
  );
}
