import type { Metadata } from "next";

import { BrandApplications } from "@/components/applications/BrandApplications";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Brand applications",
};

export default function BrandApplicationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Creator pipeline"
        title="Applications"
        description="Review creators who applied to your campaigns and make a decision on pending applications."
      />
      <BrandApplications />
    </>
  );
}
