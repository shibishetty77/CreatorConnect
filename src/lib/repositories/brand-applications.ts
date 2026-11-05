import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { pool, query } from "@/lib/db";
import type { ApplicationStatus } from "@/lib/repositories/applications";
import type { AcceptApplicationInput } from "@/lib/validations/applications";

type BrandApplicationRow = RowDataPacket & {
  application_id: number;
  campaign_id: number;
  campaign_name: string;
  campaign_start_date: string | null;
  campaign_end_date: string | null;
  campaign_status: string;
  budget: string | number;
  applied_date: string;
  status: ApplicationStatus;
  creator_id: number;
  first_name: string;
  last_name: string;
  username: string;
  bio: string | null;
  city: string | null;
  state: string | null;
};

type CreatorAccountRow = RowDataPacket & {
  creator_id: number;
  platform: string;
  username: string;
  followers: number | string;
  engagement_rate: number | string | null;
};

export type BrandApplicationRecord = {
  applicationId: number;
  campaignId: number;
  campaignName: string;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
  campaignStatus: string;
  campaignBudget: string;
  appliedDate: string;
  status: ApplicationStatus;
  creator: {
    creatorId: number;
    firstName: string;
    lastName: string;
    username: string;
    bio: string | null;
    city: string | null;
    state: string | null;
    socialAccounts: Array<{
      platform: string;
      username: string;
      followers: number;
      engagementRate: string | null;
    }>;
  };
};

export async function listBrandApplications(
  brandId: number,
): Promise<BrandApplicationRecord[]> {
  const [applicationRows, accountRows] = await Promise.all([
    query<BrandApplicationRow[]>(
      `SELECT a.application_id, a.campaign_id, ca.campaign_name,
              ca.start_date AS campaign_start_date,
              ca.end_date AS campaign_end_date, ca.status AS campaign_status,
              ca.budget, a.applied_date, a.status, cr.creator_id,
              cr.first_name, cr.last_name, u.username, cr.bio, cr.city, cr.state
       FROM applications a
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN creators cr ON cr.creator_id = a.creator_id
       INNER JOIN users u ON u.user_id = cr.user_id
       WHERE ca.brand_id = ?
         AND NOT EXISTS (SELECT 1 FROM collaborations request_collab WHERE request_collab.application_id = a.application_id AND request_collab.requested_by IS NOT NULL)
       ORDER BY
         CASE WHEN a.status = 'Pending' THEN 0 ELSE 1 END,
         a.applied_date DESC, a.application_id DESC`,
      [brandId],
    ),
    query<CreatorAccountRow[]>(
      `SELECT cr.creator_id, sa.platform, sa.username, sa.followers,
              sa.engagement_rate
       FROM creator_social_accounts sa
       INNER JOIN creators cr ON cr.creator_id = sa.creator_id
       INNER JOIN applications a ON a.creator_id = cr.creator_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE ca.brand_id = ?
         AND NOT EXISTS (SELECT 1 FROM collaborations request_collab WHERE request_collab.application_id = a.application_id AND request_collab.requested_by IS NOT NULL)
       GROUP BY cr.creator_id, sa.account_id, sa.platform, sa.username,
                sa.followers, sa.engagement_rate
       ORDER BY cr.creator_id ASC, sa.followers DESC, sa.account_id ASC`,
      [brandId],
    ),
  ]);

  const accountsByCreator = new Map<
    number,
    BrandApplicationRecord["creator"]["socialAccounts"]
  >();

  for (const row of accountRows) {
    const accounts = accountsByCreator.get(row.creator_id) ?? [];
    accounts.push({
      platform: row.platform,
      username: row.username,
      followers: Number(row.followers),
      engagementRate:
        row.engagement_rate === null
          ? null
          : Number(row.engagement_rate).toFixed(2),
    });
    accountsByCreator.set(row.creator_id, accounts);
  }

  return applicationRows.map((row) => ({
    applicationId: row.application_id,
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    campaignStartDate: row.campaign_start_date,
    campaignEndDate: row.campaign_end_date,
    campaignStatus: row.campaign_status,
    campaignBudget: String(row.budget),
    appliedDate: row.applied_date,
    status: row.status,
    creator: {
      creatorId: row.creator_id,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
      bio: row.bio,
      city: row.city,
      state: row.state,
      socialAccounts: accountsByCreator.get(row.creator_id) ?? [],
    },
  }));
}

export type ApplicationDecisionErrorCode =
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_NOT_PENDING"
  | "CAMPAIGN_FULL"
  | "COLLABORATION_EXISTS"
  | "COLLABORATION_REQUEST";

export class ApplicationDecisionError extends Error {
  constructor(
    readonly code: ApplicationDecisionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApplicationDecisionError";
  }
}

type ApplicationCampaignRow = RowDataPacket & {
  campaign_id: number;
};

type LockedCampaignRow = RowDataPacket & {
  campaign_id: number;
  brand_id: number;
  creator_limit: number | string;
};

type LockedApplicationRow = RowDataPacket & {
  application_id: number;
  campaign_id: number;
  status: ApplicationStatus;
  requested_by: "Brand" | "Creator" | null;
};

type AcceptedCountRow = RowDataPacket & {
  accepted_count: number | string;
};

type MysqlError = {
  code?: unknown;
  sqlMessage?: unknown;
};

function isDuplicateCollaboration(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const databaseError = error as MysqlError;
  const message =
    typeof databaseError.sqlMessage === "string"
      ? databaseError.sqlMessage.toLowerCase()
      : "";

  return (
    databaseError.code === "ER_DUP_ENTRY" &&
    (message.includes("application_id") ||
      message.includes("collaborations.application_id"))
  );
}

async function rollbackOrDestroy(connection: PoolConnection): Promise<void> {
  try {
    await connection.rollback();
  } catch (error) {
    connection.destroy();
    console.error(
      "Application decision rollback failed; connection discarded:",
      error instanceof Error ? error.message : "Unknown error",
    );
    throw error;
  }
}

async function lockApplicationForBrand(
  connection: PoolConnection,
  applicationId: number,
  brandId: number,
): Promise<{ campaign: LockedCampaignRow; application: LockedApplicationRow }> {
  const [applicationRows] = await connection.execute<ApplicationCampaignRow[]>(
    `SELECT campaign_id
     FROM applications
     WHERE application_id = ?
     LIMIT 1`,
    [applicationId],
  );
  const applicationReference = applicationRows[0];

  if (!applicationReference) {
    throw new ApplicationDecisionError(
      "APPLICATION_NOT_FOUND",
      "This application could not be found.",
    );
  }

  const [campaignRows] = await connection.execute<LockedCampaignRow[]>(
    `SELECT campaign_id, brand_id, creator_limit
     FROM campaigns
     WHERE campaign_id = ?
     FOR UPDATE`,
    [applicationReference.campaign_id],
  );
  const campaign = campaignRows[0];

  if (!campaign || campaign.brand_id !== brandId) {
    throw new ApplicationDecisionError(
      "APPLICATION_NOT_FOUND",
      "This application could not be found.",
    );
  }

  const [applicationLockedRows] =
    await connection.execute<LockedApplicationRow[]>(
      `SELECT a.application_id, a.campaign_id, a.status,
              (SELECT co.requested_by FROM collaborations co
               WHERE co.application_id = a.application_id LIMIT 1) AS requested_by
       FROM applications a
       WHERE a.application_id = ? AND a.campaign_id = ?
       FOR UPDATE`,
      [applicationId, campaign.campaign_id],
    );
  const application = applicationLockedRows[0];

  if (!application) {
    throw new ApplicationDecisionError(
      "APPLICATION_NOT_FOUND",
      "This application could not be found.",
    );
  }

  if (application.requested_by !== null) {
    throw new ApplicationDecisionError(
      "COLLABORATION_REQUEST",
      "This collaboration request must be accepted or rejected from the requests section.",
    );
  }

  if (application.status !== "Pending") {
    throw new ApplicationDecisionError(
      "APPLICATION_NOT_PENDING",
      "This application has already been reviewed.",
    );
  }

  return { campaign, application };
}

export async function acceptBrandApplication(
  brandId: number,
  applicationId: number,
  input: AcceptApplicationInput,
): Promise<{ applicationId: number; collaborationId: number }> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    const { campaign, application } = await lockApplicationForBrand(
      connection,
      applicationId,
      brandId,
    );

    const [acceptedRows] = await connection.execute<AcceptedCountRow[]>(
      `SELECT COUNT(*) AS accepted_count
       FROM applications
       WHERE campaign_id = ? AND status = 'Accepted'`,
      [campaign.campaign_id],
    );

    if (
      Number(acceptedRows[0]?.accepted_count ?? 0) >=
      Number(campaign.creator_limit)
    ) {
      throw new ApplicationDecisionError(
        "CAMPAIGN_FULL",
        "This campaign has reached its creator limit.",
      );
    }

    const [existingCollaborations] =
      await connection.execute<RowDataPacket[]>(
        `SELECT collaboration_id
         FROM collaborations
         WHERE application_id = ?
         LIMIT 1`,
        [application.application_id],
      );

    if (existingCollaborations.length > 0) {
      throw new ApplicationDecisionError(
        "COLLABORATION_EXISTS",
        "A collaboration already exists for this application.",
      );
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE applications
       SET status = 'Accepted'
       WHERE application_id = ? AND status = 'Pending'`,
      [application.application_id],
    );

    const [collaborationResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO collaborations
         (application_id, agreed_amount, start_date, end_date, status)
       VALUES (?, ?, ?, ?, 'Active')`,
      [
        application.application_id,
        input.agreedAmount,
        input.startDate,
        input.endDate,
      ],
    );

    await connection.commit();

    return {
      applicationId: application.application_id,
      collaborationId: collaborationResult.insertId,
    };
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Application acceptance failed and transaction rollback also failed:",
        rollbackError instanceof Error
          ? rollbackError.message
          : "Unknown error",
      );
    }

    if (error instanceof ApplicationDecisionError) {
      throw error;
    }

    if (isDuplicateCollaboration(error)) {
      throw new ApplicationDecisionError(
        "COLLABORATION_EXISTS",
        "A collaboration already exists for this application.",
      );
    }

    throw error;
  } finally {
    if (!connectionDestroyed) {
      connection.release();
    }
  }
}

export async function rejectBrandApplication(
  brandId: number,
  applicationId: number,
): Promise<{ applicationId: number; status: "Rejected" }> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    const { application } = await lockApplicationForBrand(
      connection,
      applicationId,
      brandId,
    );

    await connection.execute<ResultSetHeader>(
      `UPDATE applications
       SET status = 'Rejected'
       WHERE application_id = ? AND status = 'Pending'`,
      [application.application_id],
    );

    await connection.commit();

    return {
      applicationId: application.application_id,
      status: "Rejected",
    };
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Application rejection failed and transaction rollback also failed:",
        rollbackError instanceof Error
          ? rollbackError.message
          : "Unknown error",
      );
    }

    throw error;
  } finally {
    if (!connectionDestroyed) {
      connection.release();
    }
  }
}
