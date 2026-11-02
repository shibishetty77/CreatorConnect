import type { RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";

export type ApplicationStatus = "Pending" | "Accepted" | "Rejected";

type CreatorApplicationRow = RowDataPacket & {
  application_id: number;
  campaign_id: number;
  campaign_name: string;
  brand_name: string;
  budget: string | number;
  applied_date: string;
  status: ApplicationStatus;
};

export type CreatorApplicationRecord = {
  applicationId: number;
  campaignId: number;
  campaignName: string;
  brandName: string;
  budget: string;
  appliedDate: string;
  status: ApplicationStatus;
};

export async function listCreatorApplications(
  creatorId: number,
): Promise<CreatorApplicationRecord[]> {
  const rows = await query<CreatorApplicationRow[]>(
    `SELECT a.application_id, a.campaign_id, ca.campaign_name, b.brand_name,
            ca.budget, a.applied_date, a.status
     FROM applications a
     INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
     INNER JOIN brands b ON b.brand_id = ca.brand_id
     WHERE a.creator_id = ?
     ORDER BY a.applied_date DESC, a.application_id DESC`,
    [creatorId],
  );

  return rows.map((row) => ({
    applicationId: row.application_id,
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    brandName: row.brand_name,
    budget: String(row.budget),
    appliedDate: row.applied_date,
    status: row.status,
  }));
}
