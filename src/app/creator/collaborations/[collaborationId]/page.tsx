import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollaborationDetails } from "@/components/collaborations/CollaborationDetails";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireRole } from "@/lib/auth/guards";
import { getCollaborationForActor } from "@/lib/repositories/collaborations";
import { collaborationIdParamSchema } from "@/lib/validations/collaborations";

export const metadata: Metadata = {
  title: "Collaboration details",
};

type CreatorCollaborationPageProps = {
  params: Promise<{ collaborationId: string }>;
};

export default async function CreatorCollaborationDetailPage({
  params,
}: CreatorCollaborationPageProps) {
  const user = await requireRole("Creator");

  if (!user.creatorProfile) {
    notFound();
  }

  const { collaborationId: rawId } = await params;
  const parsedId = collaborationIdParamSchema.safeParse(rawId);

  if (!parsedId.success) {
    notFound();
  }

  const collaboration = await getCollaborationForActor({
    collaborationId: parsedId.data,
    role: "Creator",
    creatorId: user.creatorProfile.creatorId,
    brandId: null,
  });

  if (!collaboration) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Collaboration"
        title={collaboration.campaignName}
        description="Review the agreed terms and dates for this collaboration."
      />
      <CollaborationDetails
        initialCollaboration={collaboration}
        canEdit={false}
      />
    </>
  );
}
