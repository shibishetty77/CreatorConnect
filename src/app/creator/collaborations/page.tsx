import type { Metadata } from "next";

import { CollaborationList } from "@/components/collaborations/CollaborationList";
import { CollaborationRequests } from "@/components/collaborations/CollaborationRequests";
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
        description="Review incoming brand proposals, propose new collaborations, and track accepted agreements."
      />
      <div className="form-stack">
        <CollaborationRequests role="creator" />
        <CollaborationList role="creator" />
      </div>
    </>
  );
}
