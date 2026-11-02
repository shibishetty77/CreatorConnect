import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { pool, query } from "@/lib/db";
import type { ContractDatesInput, DeliverableCreateInput, DeliverableUpdateInput } from "@/lib/validations/delivery";

export type DeliverableContentType = "Reel" | "Story" | "Post" | "Video";
export type DeliverableStatus = "Pending" | "Completed";
export type SubmissionApprovalStatus = "Pending" | "Approved" | "Rejected";

export type ContentSubmissionRecord = {
  submissionId: number;
  contentUrl: string | null;
  submittedDate: string | null;
  approvalStatus: SubmissionApprovalStatus;
};

export type DeliverableRecord = {
  deliverableId: number;
  collaborationId: number;
  campaignName: string;
  creatorName: string;
  creatorUsername: string;
  brandName: string;
  collaborationStatus: "Active" | "Completed";
  contentType: DeliverableContentType | null;
  dueDate: string | null;
  status: DeliverableStatus;
  submissions: ContentSubmissionRecord[];
};

export type ContractRecord = {
  contractId: number;
  collaborationId: number;
  campaignName: string;
  creatorName: string;
  creatorUsername: string;
  brandName: string;
  agreedAmount: string;
  collaborationStartDate: string;
  collaborationEndDate: string;
  signedDate: string | null;
  expiryDate: string | null;
};

type DeliveryRow = RowDataPacket & {
  deliverable_id: number;
  collaboration_id: number;
  campaign_name: string;
  creator_first_name: string;
  creator_last_name: string;
  creator_username: string;
  brand_name: string;
  collaboration_status: "Active" | "Completed";
  content_type: DeliverableContentType | null;
  due_date: string | null;
  deliverable_status: DeliverableStatus;
  submission_id: number | null;
  content_url: string | null;
  submitted_date: string | null;
  approval_status: SubmissionApprovalStatus | null;
};

type ContractRow = RowDataPacket & {
  contract_id: number | null;
  collaboration_id: number;
  campaign_name: string;
  creator_first_name: string;
  creator_last_name: string;
  creator_username: string;
  brand_name: string;
  agreed_amount: string | number;
  collaboration_start_date: string;
  collaboration_end_date: string;
  signed_date: string | null;
  expiry_date: string | null;
};

function creatorName(row: {
  creator_first_name: string;
  creator_last_name: string;
}): string {
  return [row.creator_first_name, row.creator_last_name]
    .filter(Boolean)
    .join(" ");
}

function mapContract(row: ContractRow): ContractRecord | null {
  if (row.contract_id === null) {
    return null;
  }

  return {
    contractId: row.contract_id,
    collaborationId: row.collaboration_id,
    campaignName: row.campaign_name,
    creatorName: creatorName(row),
    creatorUsername: row.creator_username,
    brandName: row.brand_name,
    agreedAmount: String(row.agreed_amount),
    collaborationStartDate: row.collaboration_start_date,
    collaborationEndDate: row.collaboration_end_date,
    signedDate: row.signed_date,
    expiryDate: row.expiry_date,
  };
}

const deliverySelect = `SELECT d.deliverable_id, d.collaboration_id, ca.campaign_name,
       cr.first_name AS creator_first_name, cr.last_name AS creator_last_name,
       creator_user.username AS creator_username, b.brand_name,
       co.status AS collaboration_status, d.content_type,
       d.due_date, d.status AS deliverable_status,
       cs.submission_id, cs.content_url, cs.submitted_date,
       cs.approval_status
FROM deliverables d
INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
INNER JOIN applications a ON a.application_id = co.application_id
INNER JOIN creators cr ON cr.creator_id = a.creator_id
INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
INNER JOIN brands b ON b.brand_id = ca.brand_id
LEFT JOIN content_submissions cs ON cs.deliverable_id = d.deliverable_id`;

export async function listCreatorDeliverables(
  creatorId: number,
): Promise<DeliverableRecord[]> {
  return listDeliverablesForActor("Creator", creatorId);
}

export async function listBrandDeliverables(
  brandId: number,
): Promise<DeliverableRecord[]> {
  return listDeliverablesForActor("Brand", brandId);
}

async function listDeliverablesForActor(
  role: "Creator" | "Brand",
  profileId: number,
): Promise<DeliverableRecord[]> {
  const ownerClause =
    role === "Creator" ? "a.creator_id = ?" : "ca.brand_id = ?";
  const rows = await query<DeliveryRow[]>(
    `${deliverySelect}
     WHERE ${ownerClause}
     ORDER BY d.due_date IS NULL, d.due_date ASC, d.deliverable_id DESC,
              cs.submission_id ASC`,
    [profileId],
  );
  const deliverables = new Map<number, DeliverableRecord>();

  for (const row of rows) {
    let deliverable = deliverables.get(row.deliverable_id);

    if (!deliverable) {
      deliverable = {
        deliverableId: row.deliverable_id,
        collaborationId: row.collaboration_id,
        campaignName: row.campaign_name,
        creatorName: creatorName(row),
        creatorUsername: row.creator_username,
        brandName: row.brand_name,
        collaborationStatus: row.collaboration_status,
        contentType: row.content_type,
        dueDate: row.due_date,
        status: row.deliverable_status,
        submissions: [],
      };
      deliverables.set(row.deliverable_id, deliverable);
    }

    if (
      row.submission_id !== null &&
      row.approval_status !== null
    ) {
      deliverable.submissions.push({
        submissionId: row.submission_id,
        contentUrl: row.content_url,
        submittedDate: row.submitted_date,
        approvalStatus: row.approval_status,
      });
    }
  }

  return Array.from(deliverables.values());
}

export type DeliveryErrorCode =
  | "COLLABORATION_NOT_FOUND"
  | "DELIVERABLE_NOT_FOUND"
  | "SUBMISSION_NOT_FOUND"
  | "DELIVERABLE_COMPLETED"
  | "COLLABORATION_COMPLETED"
  | "SUBMISSION_PENDING"
  | "SUBMISSION_ALREADY_REVIEWED"
  | "SUBMISSIONS_EXIST"
  | "DELIVERABLE_NOT_PENDING"
  | "CONTRACT_EXISTS"
  | "CONTRACT_NOT_FOUND";

export class DeliveryError extends Error {
  constructor(
    readonly code: DeliveryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DeliveryError";
  }
}

type LockedCollaborationRow = RowDataPacket & {
  collaboration_id: number;
  creator_id: number;
  brand_id: number;
  status: "Active" | "Completed";
};

type LockedDeliverableRow = RowDataPacket & {
  deliverable_id: number;
  collaboration_id: number;
  creator_id: number;
  brand_id: number;
  collaboration_status: "Active" | "Completed";
  status: DeliverableStatus;
};

type SubmissionReferenceRow = RowDataPacket & {
  submission_id: number;
  deliverable_id: number;
};

type LockedSubmissionRow = RowDataPacket & {
  submission_id: number;
  approval_status: SubmissionApprovalStatus;
};

type LatestSubmissionRow = RowDataPacket & {
  submission_id: number;
  approval_status: SubmissionApprovalStatus;
};

async function rollbackOrDestroy(connection: PoolConnection): Promise<void> {
  try {
    await connection.rollback();
  } catch (error) {
    connection.destroy();
    console.error(
      "Delivery transaction rollback failed; connection discarded:",
      error instanceof Error ? error.message : "Unknown error",
    );
    throw error;
  }
}

async function getLockedCollaboration(
  connection: PoolConnection,
  collaborationId: number,
): Promise<LockedCollaborationRow | undefined> {
  const [rows] = await connection.execute<LockedCollaborationRow[]>(
    `SELECT co.collaboration_id, a.creator_id, ca.brand_id, co.status
     FROM collaborations co
     INNER JOIN applications a ON a.application_id = co.application_id
     INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
     WHERE co.collaboration_id = ?
     FOR UPDATE`,
    [collaborationId],
  );
  return rows[0];
}

async function getLockedDeliverable(
  connection: PoolConnection,
  deliverableId: number,
): Promise<LockedDeliverableRow | undefined> {
  const [rows] = await connection.execute<LockedDeliverableRow[]>(
    `SELECT d.deliverable_id, d.collaboration_id, a.creator_id, ca.brand_id,
            co.status AS collaboration_status, d.status
     FROM deliverables d
     INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
     INNER JOIN applications a ON a.application_id = co.application_id
     INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
     WHERE d.deliverable_id = ?
     FOR UPDATE`,
    [deliverableId],
  );
  return rows[0];
}

export async function createDeliverable(
  brandId: number,
  collaborationId: number,
  input: DeliverableCreateInput,
): Promise<{ deliverableId: number }> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    const collaboration = await getLockedCollaboration(
      connection,
      collaborationId,
    );

    if (!collaboration || collaboration.brand_id !== brandId) {
      throw new DeliveryError(
        "COLLABORATION_NOT_FOUND",
        "This collaboration could not be found.",
      );
    }

    if (collaboration.status !== "Active") {
      throw new DeliveryError(
        "COLLABORATION_COMPLETED",
        "Deliverables cannot be added to a completed collaboration.",
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO deliverables (collaboration_id, content_type, due_date, status)
       VALUES (?, ?, ?, 'Pending')`,
      [collaborationId, input.contentType, input.dueDate],
    );
    await connection.commit();
    return { deliverableId: result.insertId };
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Deliverable creation rollback failed:",
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

export async function updateDeliverable(
  brandId: number,
  deliverableId: number,
  updates: DeliverableUpdateInput,
): Promise<void> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    const deliverable = await getLockedDeliverable(connection, deliverableId);

    if (!deliverable || deliverable.brand_id !== brandId) {
      throw new DeliveryError(
        "DELIVERABLE_NOT_FOUND",
        "This deliverable could not be found.",
      );
    }
    if (deliverable.status !== "Pending") {
      throw new DeliveryError(
        "DELIVERABLE_COMPLETED",
        "Completed deliverables cannot be changed.",
      );
    }

    const [pendingRows] = await connection.execute<RowDataPacket[]>(
      `SELECT submission_id
       FROM content_submissions
       WHERE deliverable_id = ? AND approval_status = 'Pending'
       LIMIT 1
       FOR UPDATE`,
      [deliverableId],
    );
    if (pendingRows.length > 0) {
      throw new DeliveryError(
        "SUBMISSION_PENDING",
        "A pending submission must be reviewed before changing this deliverable.",
      );
    }

    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    if (updates.contentType !== undefined) {
      fields.push("content_type = ?");
      values.push(updates.contentType);
    }
    if (updates.dueDate !== undefined) {
      fields.push("due_date = ?");
      values.push(updates.dueDate);
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE deliverables SET ${fields.join(", ")} WHERE deliverable_id = ?`,
      [...values, deliverableId],
    );
    await connection.commit();
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Deliverable update rollback failed:",
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

export async function deleteDeliverable(
  brandId: number,
  deliverableId: number,
): Promise<void> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    const deliverable = await getLockedDeliverable(connection, deliverableId);

    if (!deliverable || deliverable.brand_id !== brandId) {
      throw new DeliveryError(
        "DELIVERABLE_NOT_FOUND",
        "This deliverable could not be found.",
      );
    }
    if (deliverable.status !== "Pending") {
      throw new DeliveryError(
        "DELIVERABLE_COMPLETED",
        "Completed deliverables cannot be deleted.",
      );
    }

    const [submissionRows] = await connection.execute<RowDataPacket[]>(
      `SELECT submission_id
       FROM content_submissions
       WHERE deliverable_id = ?
       LIMIT 1
       FOR UPDATE`,
      [deliverableId],
    );
    if (submissionRows.length > 0) {
      throw new DeliveryError(
        "SUBMISSIONS_EXIST",
        "Deliverables with submission history cannot be deleted.",
      );
    }

    await connection.execute<ResultSetHeader>(
      "DELETE FROM deliverables WHERE deliverable_id = ?",
      [deliverableId],
    );
    await connection.commit();
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Deliverable deletion rollback failed:",
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

export async function submitDeliverable(
  creatorId: number,
  deliverableId: number,
  contentUrl: string,
): Promise<{ submissionId: number }> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    const deliverable = await getLockedDeliverable(connection, deliverableId);

    if (!deliverable || deliverable.creator_id !== creatorId) {
      throw new DeliveryError(
        "DELIVERABLE_NOT_FOUND",
        "This deliverable could not be found.",
      );
    }
    if (deliverable.collaboration_status !== "Active") {
      throw new DeliveryError(
        "COLLABORATION_COMPLETED",
        "Submissions cannot be added to a completed collaboration.",
      );
    }
    if (deliverable.status !== "Pending") {
      throw new DeliveryError(
        "DELIVERABLE_COMPLETED",
        "This deliverable has already been completed.",
      );
    }

    const [latestRows] = await connection.execute<LatestSubmissionRow[]>(
      `SELECT submission_id, approval_status
       FROM content_submissions
       WHERE deliverable_id = ?
       ORDER BY submission_id DESC
       LIMIT 1
       FOR UPDATE`,
      [deliverableId],
    );
    const latestSubmission = latestRows[0];
    if (
      latestSubmission &&
      latestSubmission.approval_status !== "Rejected"
    ) {
      throw new DeliveryError(
        latestSubmission.approval_status === "Pending"
          ? "SUBMISSION_PENDING"
          : "DELIVERABLE_COMPLETED",
        latestSubmission.approval_status === "Pending"
          ? "Wait for the brand to review the current submission."
          : "This deliverable already has an approved submission.",
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO content_submissions
         (deliverable_id, content_url, approval_status)
       VALUES (?, ?, 'Pending')`,
      [deliverableId, contentUrl],
    );
    await connection.commit();
    return { submissionId: result.insertId };
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Submission creation rollback failed:",
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

export async function reviewSubmission(
  brandId: number,
  submissionId: number,
  approvalStatus: "Approved" | "Rejected",
): Promise<void> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    const [referenceRows] = await connection.execute<SubmissionReferenceRow[]>(
      `SELECT submission_id, deliverable_id
       FROM content_submissions
       WHERE submission_id = ?
       LIMIT 1`,
      [submissionId],
    );
    const submissionReference = referenceRows[0];

    if (!submissionReference) {
      throw new DeliveryError(
        "SUBMISSION_NOT_FOUND",
        "This submission could not be found.",
      );
    }
    const deliverable = await getLockedDeliverable(
      connection,
      submissionReference.deliverable_id,
    );
    if (!deliverable || deliverable.brand_id !== brandId) {
      throw new DeliveryError(
        "SUBMISSION_NOT_FOUND",
        "This submission could not be found.",
      );
    }
    const [submissionRows] = await connection.execute<LockedSubmissionRow[]>(
      `SELECT submission_id, approval_status
       FROM content_submissions
       WHERE submission_id = ? AND deliverable_id = ?
       FOR UPDATE`,
      [submissionId, deliverable.deliverable_id],
    );
    const submission = submissionRows[0];
    if (!submission) {
      throw new DeliveryError(
        "SUBMISSION_NOT_FOUND",
        "This submission could not be found.",
      );
    }
    if (deliverable.collaboration_status !== "Active") {
      throw new DeliveryError(
        "COLLABORATION_COMPLETED",
        "Submissions for completed collaborations cannot be reviewed.",
      );
    }
    if (submission.approval_status !== "Pending") {
      throw new DeliveryError(
        "SUBMISSION_ALREADY_REVIEWED",
        "This submission has already been reviewed.",
      );
    }
    if (deliverable.status !== "Pending") {
      throw new DeliveryError(
        "DELIVERABLE_COMPLETED",
        "The deliverable is already completed.",
      );
    }

    const [updatedSubmission] = await connection.execute<ResultSetHeader>(
      `UPDATE content_submissions
       SET approval_status = ?
       WHERE submission_id = ? AND approval_status = 'Pending'`,
      [approvalStatus, submissionId],
    );
    if (updatedSubmission.affectedRows !== 1) {
      throw new DeliveryError(
        "SUBMISSION_ALREADY_REVIEWED",
        "This submission has already been reviewed.",
      );
    }

    if (approvalStatus === "Approved") {
      const [updatedDeliverable] = await connection.execute<ResultSetHeader>(
        `UPDATE deliverables
         SET status = 'Completed'
         WHERE deliverable_id = ? AND status = 'Pending'`,
        [deliverable.deliverable_id],
      );
      if (updatedDeliverable.affectedRows !== 1) {
        throw new DeliveryError(
          "DELIVERABLE_COMPLETED",
          "The deliverable is already completed.",
        );
      }
    }

    await connection.commit();
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Submission review rollback failed:",
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

const contractSelect = `SELECT ct.contract_id, co.collaboration_id,
       ca.campaign_name, cr.first_name AS creator_first_name,
       cr.last_name AS creator_last_name, creator_user.username AS creator_username,
       b.brand_name, co.agreed_amount, co.start_date AS collaboration_start_date,
       co.end_date AS collaboration_end_date, ct.signed_date, ct.expiry_date
FROM collaborations co
INNER JOIN applications a ON a.application_id = co.application_id
INNER JOIN creators cr ON cr.creator_id = a.creator_id
INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
INNER JOIN brands b ON b.brand_id = ca.brand_id
LEFT JOIN contracts ct ON ct.collaboration_id = co.collaboration_id`;

export async function getContractForParty(input: {
  collaborationId: number;
  role: "Creator" | "Brand";
  profileId: number;
}): Promise<ContractRecord | null> {
  const ownerClause =
    input.role === "Creator" ? "a.creator_id = ?" : "ca.brand_id = ?";
  const rows = await query<ContractRow[]>(
    `${contractSelect}
     WHERE co.collaboration_id = ? AND ${ownerClause}
     LIMIT 1`,
    [input.collaborationId, input.profileId],
  );
  return rows[0] ? mapContract(rows[0]) : null;
}

async function lockOwnedCollaboration(
  connection: PoolConnection,
  collaborationId: number,
  brandId: number,
): Promise<void> {
  const collaboration = await getLockedCollaboration(
    connection,
    collaborationId,
  );
  if (!collaboration || collaboration.brand_id !== brandId) {
    throw new DeliveryError(
      "COLLABORATION_NOT_FOUND",
      "This collaboration could not be found.",
    );
  }
}

export async function createContract(
  brandId: number,
  collaborationId: number,
  input: ContractDatesInput,
): Promise<void> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    await lockOwnedCollaboration(connection, collaborationId, brandId);
    const [existingRows] = await connection.execute<RowDataPacket[]>(
      `SELECT contract_id
       FROM contracts
       WHERE collaboration_id = ?
       LIMIT 1
       FOR UPDATE`,
      [collaborationId],
    );
    if (existingRows.length > 0) {
      throw new DeliveryError(
        "CONTRACT_EXISTS",
        "A contract already exists for this collaboration.",
      );
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO contracts (collaboration_id, signed_date, expiry_date)
       VALUES (?, ?, ?)`,
      [collaborationId, input.signedDate, input.expiryDate],
    );
    await connection.commit();
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Contract creation rollback failed:",
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

export async function updateContract(
  brandId: number,
  collaborationId: number,
  input: ContractDatesInput,
): Promise<void> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    await lockOwnedCollaboration(connection, collaborationId, brandId);
    const [contractRows] = await connection.execute<RowDataPacket[]>(
      `SELECT contract_id
       FROM contracts
       WHERE collaboration_id = ?
       LIMIT 1
       FOR UPDATE`,
      [collaborationId],
    );
    if (contractRows.length === 0) {
      throw new DeliveryError(
        "CONTRACT_NOT_FOUND",
        "No contract exists for this collaboration.",
      );
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE contracts
       SET signed_date = ?, expiry_date = ?
       WHERE collaboration_id = ?`,
      [input.signedDate, input.expiryDate, collaborationId],
    );
    await connection.commit();
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Contract update rollback failed:",
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
