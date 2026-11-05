import type { Metadata } from "next";

import { CollaborationList } from "@/components/collaborations/CollaborationList";
import { CollaborationRequests } from "@/components/collaborations/CollaborationRequests";
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
        description="Invite creators, respond to creator proposals, and track every active agreement."
      />
      <div className="form-stack">
        <CollaborationRequests role="brand" />
        <CollaborationList role="brand" />
      </div>
    </>
  );
}
