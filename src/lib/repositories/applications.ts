import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool, query } from "@/lib/db";

export type ApplicationStatus = "Pending" | "Accepted" | "Rejected";

type CreatorApplicationRow = RowDataPacket & {
  application_id: number;
  campaign_id: number;
  campaign_name: string;
  campaign_status: "Open" | "Ongoing" | "Completed";
  campaign_description: string | null;
  category_name: string | null;
  brand_id: number;
  brand_name: string;
  budget: string | number;
  start_date: string;
  end_date: string;
  applied_date: string;
  status: ApplicationStatus;
  collaboration_id: number | null;
};

type ApplicationCountRow = RowDataPacket & {
  total: number | string;
};

type ApplicationStatusCountRow = RowDataPacket & {
  status: ApplicationStatus;
  total: number | string;
};

type LockedApplicationRow = RowDataPacket & {
  application_id: number;
  creator_id: number;
  status: ApplicationStatus;
  collaboration_id: number | null;
};

export type CreatorApplicationRecord = {
  applicationId: number;
  campaignId: number;
  campaignName: string;
  campaignStatus: "Open" | "Ongoing" | "Completed";
  campaignDescription: string | null;
  categoryName: string | null;
  brandId: number;
  brandName: string;
  budget: string;
  startDate: string;
  endDate: string;
  appliedDate: string;
  status: ApplicationStatus;
  collaborationId: number | null;
};

export type CreatorApplicationFilters = {
  q?: string;
  status?: ApplicationStatus | "all";
  page: number;
  pageSize: number;
};

export type CreatorApplicationPage = {
  applications: CreatorApplicationRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts: Record<ApplicationStatus, number>;
};

const applicationSelect = `SELECT a.application_id, a.campaign_id,
       ca.campaign_name, ca.status AS campaign_status,
       ca.description AS campaign_description,
       cc.category_name, b.brand_id, b.brand_name, ca.budget,
       ca.start_date, ca.end_date, a.applied_date, a.status,
       co.collaboration_id
FROM applications a
INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
INNER JOIN brands b ON b.brand_id = ca.brand_id
LEFT JOIN campaign_categories cc ON cc.category_id = ca.category_id
LEFT JOIN collaborations co ON co.application_id = a.application_id`;

function mapApplication(row: CreatorApplicationRow): CreatorApplicationRecord {
  return {
    applicationId: row.application_id,
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    campaignStatus: row.campaign_status,
    campaignDescription: row.campaign_description,
    categoryName: row.category_name,
    brandId: row.brand_id,
    brandName: row.brand_name,
    budget: String(row.budget),
    startDate: row.start_date,
    endDate: row.end_date,
    appliedDate: row.applied_date,
    status: row.status,
    collaborationId: row.collaboration_id,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function listCreatorApplications(
  creatorId: number,
  filters: CreatorApplicationFilters,
): Promise<CreatorApplicationPage> {
  const where = [
    "a.creator_id = ?",
    "NOT EXISTS (SELECT 1 FROM collaborations request_collab WHERE request_collab.application_id = a.application_id AND request_collab.requested_by IS NOT NULL)",
  ];
  const params: Array<string | number> = [creatorId];

  if (filters.status && filters.status !== "all") {
    where.push("a.status = ?");
    params.push(filters.status);
  }

  const search = filters.q?.trim();

  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    where.push("(ca.campaign_name LIKE ? OR b.brand_name LIKE ?)");
    params.push(pattern, pattern);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, countRows, statusRows] = await Promise.all([
    query<CreatorApplicationRow[]>(
      `${applicationSelect}
       ${whereSql}
       ORDER BY a.applied_date DESC, a.application_id DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.pageSize, offset],
    ),
    query<ApplicationCountRow[]>(
      `SELECT COUNT(*) AS total
       FROM applications a
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN brands b ON b.brand_id = ca.brand_id
       ${whereSql}`,
      params,
    ),
    query<ApplicationStatusCountRow[]>(
      `SELECT a.status, COUNT(*) AS total
       FROM applications a
       WHERE a.creator_id = ?
         AND NOT EXISTS (SELECT 1 FROM collaborations request_collab WHERE request_collab.application_id = a.application_id AND request_collab.requested_by IS NOT NULL)
       GROUP BY a.status`,
      [creatorId],
    ),
  ]);

  const statusCounts: Record<ApplicationStatus, number> = {
    Pending: 0,
    Accepted: 0,
    Rejected: 0,
  };

  for (const row of statusRows) {
    statusCounts[row.status] = Number(row.total);
  }

  const total = Number(countRows[0]?.total ?? 0);

  return {
    applications: rows.map(mapApplication),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    statusCounts,
  };
}

export async function getCreatorApplicationById(
  creatorId: number,
  applicationId: number,
): Promise<CreatorApplicationRecord | null> {
  const rows = await query<CreatorApplicationRow[]>(
    `${applicationSelect}
     WHERE a.application_id = ? AND a.creator_id = ?
       AND NOT EXISTS (SELECT 1 FROM collaborations request_collab WHERE request_collab.application_id = a.application_id AND request_collab.requested_by IS NOT NULL)
     LIMIT 1`,
    [applicationId, creatorId],
  );

  return rows[0] ? mapApplication(rows[0]) : null;
}

export type ApplicationWithdrawalErrorCode =
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_NOT_PENDING"
  | "COLLABORATION_ALREADY_CREATED";

export class ApplicationWithdrawalError extends Error {
  constructor(
    readonly code: ApplicationWithdrawalErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApplicationWithdrawalError";
  }
}

export async function withdrawCreatorApplication(
  creatorId: number,
  applicationId: number,
): Promise<void> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<LockedApplicationRow[]>(
      `SELECT a.application_id, a.creator_id, a.status,
              co.collaboration_id
       FROM applications a
       LEFT JOIN collaborations co ON co.application_id = a.application_id
       WHERE a.application_id = ?
       FOR UPDATE`,
      [applicationId],
    );
    const application = rows[0];

    if (!application || application.creator_id !== creatorId) {
      throw new ApplicationWithdrawalError(
        "APPLICATION_NOT_FOUND",
        "This application could not be found.",
      );
    }

    if (application.status !== "Pending") {
      throw new ApplicationWithdrawalError(
        "APPLICATION_NOT_PENDING",
        "Only pending applications can be withdrawn.",
      );
    }

    if (application.collaboration_id !== null) {
      throw new ApplicationWithdrawalError(
        "COLLABORATION_ALREADY_CREATED",
        "A collaboration already exists for this application.",
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `DELETE FROM applications
       WHERE application_id = ? AND creator_id = ? AND status = 'Pending'`,
      [applicationId, creatorId],
    );

    if (result.affectedRows !== 1) {
      throw new ApplicationWithdrawalError(
        "APPLICATION_NOT_FOUND",
        "This application could not be withdrawn.",
      );
    }

    await connection.commit();
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      connection.destroy();
      connectionDestroyed = true;
      console.error(
        "Application withdrawal rollback failed; connection discarded:",
        rollbackError instanceof Error ? rollbackError.message : "Unknown error",
      );
    }

    throw error;
  } finally {
    if (!connectionDestroyed) {
      connection.release();
    }
  }
}

export async function getApplicationStatusCounts(
  creatorId: number,
): Promise<Record<ApplicationStatus, number>> {
  const rows = await query<ApplicationStatusCountRow[]>(
    `SELECT status, COUNT(*) AS total
     FROM applications
     WHERE creator_id = ?
       AND NOT EXISTS (SELECT 1 FROM collaborations request_collab WHERE request_collab.application_id = applications.application_id AND request_collab.requested_by IS NOT NULL)
     GROUP BY status`,
    [creatorId],
  );
  const counts: Record<ApplicationStatus, number> = {
    Pending: 0,
    Accepted: 0,
    Rejected: 0,
  };

  for (const row of rows) {
    counts[row.status] = Number(row.total);
  }

  return counts;
}
