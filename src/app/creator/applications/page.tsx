import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";
import { listCreatorApplications } from "@/lib/repositories/applications";

export const metadata: Metadata = {
  title: "My applications",
};

export default async function CreatorApplicationsPage() {
  const user = await requireRole("Creator");

  if (!user.creatorProfile) {
    notFound();
  }

  const applications = await listCreatorApplications(
    user.creatorProfile.creatorId,
  );

  return (
    <>
      <PageHeader
        eyebrow="Application pipeline"
        title="My applications"
        description="Review every application you have submitted and where it stands."
      />

      <section className="panel">
        {applications.length === 0 ? (
          <p className="empty-note">
            You have not submitted any campaign applications yet.
          </p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <caption className="sr-only">Your campaign applications</caption>
              <thead>
                <tr>
                  <th scope="col">Campaign</th>
                  <th scope="col">Brand</th>
                  <th scope="col">Applied</th>
                  <th scope="col">Campaign budget</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.applicationId}>
                    <td>
                      <strong>{application.campaignName}</strong>
                    </td>
                    <td>{application.brandName}</td>
                    <td>{formatDate(application.appliedDate)}</td>
                    <td>INR {application.budget}</td>
                    <td>
                      <StatusBadge status={application.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
