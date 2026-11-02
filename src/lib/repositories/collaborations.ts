import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { pool, query } from "@/lib/db";
import type { Role } from "@/lib/auth/constants";
import type { CollaborationUpdateInput } from "@/lib/validations/collaborations";

export type CollaborationStatus = "Active" | "Completed";

type CollaborationRow = RowDataPacket & {
  collaboration_id: number;
  application_id: number;
  creator_id: number;
  creator_first_name: string;
  creator_last_name: string;
  creator_username: string;
  brand_id: number;
  brand_name: string;
  campaign_id: number;
  campaign_name: string;
  agreed_amount: string | number;
  start_date: string;
  end_date: string;
  status: CollaborationStatus;
};

export type CollaborationRecord = {
  collaborationId: number;
  applicationId: number;
  creatorId: number;
  creatorName: string;
  creatorUsername: string;
  brandId: number;
  brandName: string;
  campaignId: number;
  campaignName: string;
  agreedAmount: string;
  startDate: string;
  endDate: string;
  status: CollaborationStatus;
};

function mapCollaboration(row: CollaborationRow): CollaborationRecord {
  return {
    collaborationId: row.collaboration_id,
    applicationId: row.application_id,
    creatorId: row.creator_id,
    creatorName: [row.creator_first_name, row.creator_last_name]
      .filter(Boolean)
      .join(" "),
    creatorUsername: row.creator_username,
    brandId: row.brand_id,
    brandName: row.brand_name,
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    agreedAmount: String(row.agreed_amount),
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
  };
}

const collaborationSelect = `SELECT co.collaboration_id, co.application_id,
       cr.creator_id, cr.first_name AS creator_first_name,
       cr.last_name AS creator_last_name, creator_user.username AS creator_username,
       b.brand_id, b.brand_name, ca.campaign_id, ca.campaign_name,
       co.agreed_amount, co.start_date, co.end_date, co.status
FROM collaborations co
INNER JOIN applications a ON a.application_id = co.application_id
INNER JOIN creators cr ON cr.creator_id = a.creator_id
INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
INNER JOIN brands b ON b.brand_id = ca.brand_id`;

export async function listCreatorCollaborations(
  creatorId: number,
): Promise<CollaborationRecord[]> {
  const rows = await query<CollaborationRow[]>(
    `${collaborationSelect}
     WHERE cr.creator_id = ?
     ORDER BY co.start_date DESC, co.collaboration_id DESC`,
    [creatorId],
  );

  return rows.map(mapCollaboration);
}

export async function listBrandCollaborations(
  brandId: number,
): Promise<CollaborationRecord[]> {
  const rows = await query<CollaborationRow[]>(
    `${collaborationSelect}
     WHERE b.brand_id = ?
     ORDER BY co.start_date DESC, co.collaboration_id DESC`,
    [brandId],
  );

  return rows.map(mapCollaboration);
}

export async function getCollaborationForActor(input: {
  collaborationId: number;
  role: Role;
  creatorId: number | null;
  brandId: number | null;
}): Promise<CollaborationRecord | null> {
  const rows = await query<CollaborationRow[]>(
    `${collaborationSelect}
     WHERE co.collaboration_id = ?
     LIMIT 1`,
    [input.collaborationId],
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  const authorized =
    input.role === "Admin" ||
    (input.role === "Creator" && input.creatorId === row.creator_id) ||
    (input.role === "Brand" && input.brandId === row.brand_id);

  return authorized ? mapCollaboration(row) : null;
}

export type CollaborationUpdateErrorCode =
  | "COLLABORATION_NOT_FOUND"
  | "COLLABORATION_ACCESS_DENIED"
  | "INVALID_STATUS_TRANSITION"
  | "INVALID_COLLABORATION_DATES";

export class CollaborationUpdateError extends Error {
  constructor(
    readonly code: CollaborationUpdateErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CollaborationUpdateError";
  }
}

type LockedCollaborationRow = RowDataPacket & {
  collaboration_id: number;
  creator_id: number;
  brand_id: number;
  start_date: string;
  end_date: string;
  status: CollaborationStatus;
};

async function rollbackOrDestroy(connection: PoolConnection): Promise<void> {
  try {
    await connection.rollback();
  } catch (error) {
    connection.destroy();
    console.error(
      "Collaboration update rollback failed; connection discarded:",
      error instanceof Error ? error.message : "Unknown error",
    );
    throw error;
  }
}

export async function updateCollaborationForActor(input: {
  collaborationId: number;
  role: Role;
  brandId: number | null;
  updates: CollaborationUpdateInput;
}): Promise<CollaborationRecord> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<LockedCollaborationRow[]>(
      `SELECT co.collaboration_id, a.creator_id, ca.brand_id,
              co.start_date, co.end_date, co.status
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE co.collaboration_id = ?
       FOR UPDATE`,
      [input.collaborationId],
    );
    const collaboration = rows[0];

    if (!collaboration) {
      throw new CollaborationUpdateError(
        "COLLABORATION_NOT_FOUND",
        "This collaboration could not be found.",
      );
    }

    if (
      input.role !== "Admin" &&
      (input.role !== "Brand" || input.brandId !== collaboration.brand_id)
    ) {
      throw new CollaborationUpdateError(
        "COLLABORATION_ACCESS_DENIED",
        "You do not own this collaboration.",
      );
    }

    const startDate = input.updates.startDate ?? collaboration.start_date;
    const endDate = input.updates.endDate ?? collaboration.end_date;
    const status = input.updates.status ?? collaboration.status;

    if (endDate < startDate) {
      throw new CollaborationUpdateError(
        "INVALID_COLLABORATION_DATES",
        "End date must be on or after the start date.",
      );
    }

    if (collaboration.status === "Completed" && status === "Active") {
      throw new CollaborationUpdateError(
        "INVALID_STATUS_TRANSITION",
        "A completed collaboration cannot be reopened.",
      );
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE collaborations
       SET start_date = ?, end_date = ?, status = ?
       WHERE collaboration_id = ?`,
      [startDate, endDate, status, input.collaborationId],
    );

    await connection.commit();
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Collaboration update failed and transaction rollback also failed:",
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

  const result = await getCollaborationForActor({
    collaborationId: input.collaborationId,
    role: input.role,
    creatorId: null,
    brandId: input.brandId,
  });

  if (!result) {
    throw new CollaborationUpdateError(
      "COLLABORATION_NOT_FOUND",
      "The updated collaboration could not be loaded.",
    );
  }

  return result;
}
