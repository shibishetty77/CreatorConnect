import type { Metadata } from "next";

import { CollaborationList } from "@/components/collaborations/CollaborationList";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Collaborations",
};

export default function CreatorCollaborationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Active partnerships"
        title="Collaborations"
        description="Track the brand agreements created from your accepted applications."
      />
      <CollaborationList role="creator" />
    </>
  );
}
