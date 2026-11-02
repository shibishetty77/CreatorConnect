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

type BrandCollaborationPageProps = {
  params: Promise<{ collaborationId: string }>;
};

export default async function BrandCollaborationDetailPage({
  params,
}: BrandCollaborationPageProps) {
  const user = await requireRole("Brand");

  if (!user.brandProfile) {
    notFound();
  }

  const { collaborationId: rawId } = await params;
  const parsedId = collaborationIdParamSchema.safeParse(rawId);

  if (!parsedId.success) {
    notFound();
  }

  const collaboration = await getCollaborationForActor({
    collaborationId: parsedId.data,
    role: "Brand",
    creatorId: null,
    brandId: user.brandProfile.brandId,
  });

  if (!collaboration) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Collaboration"
        title={collaboration.campaignName}
        description="Review the agreed terms and update collaboration dates or status."
      />
      <CollaborationDetails initialCollaboration={collaboration} canEdit />
    </>
  );
}
