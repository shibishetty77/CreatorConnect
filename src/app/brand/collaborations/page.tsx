import type { Metadata } from "next";

import { CollaborationList } from "@/components/collaborations/CollaborationList";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Brand collaborations",
};

export default function BrandCollaborationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Creator partnerships"
        title="Collaborations"
        description="Track the creator agreements for your campaigns."
      />
      <CollaborationList role="brand" />
    </>
  );
}
