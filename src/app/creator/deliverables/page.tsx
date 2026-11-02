import type { Metadata } from "next";

import { DeliveryWorkspace } from "@/components/delivery/DeliveryWorkspace";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Deliverables",
};

export default function CreatorDeliverablesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Content delivery"
        title="Deliverables"
        description="Submit your work, track review decisions, and send revisions when requested."
      />
      <DeliveryWorkspace role="creator" />
    </>
  );
}
