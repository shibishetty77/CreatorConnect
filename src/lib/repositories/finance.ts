import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import type { Role } from "@/lib/auth/constants";
import { pool, query } from "@/lib/db";
import type {
  MetricsUpsertInput,
  PaymentCreateInput,
  PaymentUpdateInput,
  ReviewUpsertInput,
} from "@/lib/validations/finance";

export type PaymentStatus = "Pending" | "Paid";

export type PaymentRecord = {
  paymentId: number;
  collaborationId: number;
  campaignName: string;
  creatorName: string;
  creatorUsername: string;
  brandName: string;
  agreedAmount: string;
  amount: string;
  paymentDate: string | null;
  transactionReference: string | null;
  status: PaymentStatus;
  collaborationStatus: "Active" | "Completed";
};

export type MetricsRecord = {
  collaborationId: number;
  views: string;
  likes: string;
  comments: string;
  shares: string;
  clicks: string;
};

export type ReviewRecord = {
  reviewId: number;
  collaborationId: number;
  rating: number;
  feedback: string | null;
  reviewDate: string | null;
};

type PaymentRow = RowDataPacket & {
  payment_id: number;
  collaboration_id: number;
  campaign_name: string;
  creator_first_name: string;
  creator_last_name: string;
  creator_username: string;
  brand_name: string;
  agreed_amount: string | number;
  amount: string | number;
  payment_date: string | null;
  transaction_reference: string | null;
  payment_status: PaymentStatus;
  collaboration_status: "Active" | "Completed";
};

type MetricsRow = RowDataPacket & {
  collaboration_id: number;
  views: string | number;
  likes: string | number;
  comments: string | number;
  shares: string | number;
  clicks: string | number;
};

type ReviewRow = RowDataPacket & {
  review_id: number;
  collaboration_id: number;
  rating: number;
  feedback: string | null;
  review_date: string | null;
};

type OwnedCollaborationRow = RowDataPacket & {
  collaboration_id: number;
  creator_id: number;
  brand_id: number;
  agreed_amount: string | number;
  status: "Active" | "Completed";
};

type PaymentKeyRow = RowDataPacket & {
  payment_id: number;
  collaboration_id: number;
};

type LockedPaymentRow = RowDataPacket & {
  payment_id: number;
  collaboration_id: number;
  amount: string | number;
  payment_date: string | null;
  status: PaymentStatus;
};

type MysqlError = { code?: unknown };

export type FinanceErrorCode =
  | "COLLABORATION_NOT_FOUND"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_EXISTS"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "COLLABORATION_COMPLETED"
  | "INVALID_PAYMENT_TRANSITION"
  | "METRICS_NOT_FOUND"
  | "REVIEW_NOT_FOUND"
  | "REVIEW_REQUIRES_COMPLETION";

export class FinanceError extends Error {
  constructor(
    readonly code: FinanceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FinanceError";
  }
}

function mapPayment(row: PaymentRow): PaymentRecord {
  return {
    paymentId: row.payment_id,
    collaborationId: row.collaboration_id,
    campaignName: row.campaign_name,
    creatorName: [row.creator_first_name, row.creator_last_name]
      .filter(Boolean)
      .join(" "),
    creatorUsername: row.creator_username,
    brandName: row.brand_name,
    agreedAmount: String(row.agreed_amount),
    amount: String(row.amount),
    paymentDate: row.payment_date,
    transactionReference: row.transaction_reference,
    status: row.payment_status,
    collaborationStatus: row.collaboration_status,
  };
}

function mapMetrics(row: MetricsRow): MetricsRecord {
  return {
    collaborationId: row.collaboration_id,
    views: String(row.views),
    likes: String(row.likes),
    comments: String(row.comments),
    shares: String(row.shares),
    clicks: String(row.clicks),
  };
}

function mapReview(row: ReviewRow): ReviewRecord {
  return {
    reviewId: row.review_id,
    collaborationId: row.collaboration_id,
    rating: row.rating,
    feedback: row.feedback,
    reviewDate: row.review_date,
  };
}

const paymentSelect = `SELECT p.payment_id, co.collaboration_id,
       ca.campaign_name, cr.first_name AS creator_first_name,
       cr.last_name AS creator_last_name, creator_user.username AS creator_username,
       b.brand_name, co.agreed_amount, p.amount,
       p.payment_date, p.transaction_reference,
       p.status AS payment_status, co.status AS collaboration_status
FROM payments p
INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
INNER JOIN applications a ON a.application_id = co.application_id
INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
INNER JOIN creators cr ON cr.creator_id = a.creator_id
INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
INNER JOIN brands b ON b.brand_id = ca.brand_id`;

export async function listPaymentsForRole(
  role: "Creator" | "Brand" | "Admin",
  profileId?: number,
): Promise<PaymentRecord[]> {
  const where =
    role === "Creator"
      ? "WHERE cr.creator_id = ?"
      : role === "Brand"
        ? "WHERE b.brand_id = ?"
        : "";
  const params = role === "Admin" ? [] : [profileId ?? 0];
  const rows = await query<PaymentRow[]>(
    `${paymentSelect} ${where}
     ORDER BY p.payment_date DESC, p.payment_id DESC`,
    params,
  );
  return rows.map(mapPayment);
}

export type CreatorPaymentFilters = {
  q?: string;
  status?: PaymentStatus | "all";
  page: number;
  pageSize: number;
};

type PaymentCountRow = RowDataPacket & {
  total: number | string;
};

type PaymentSummaryRow = RowDataPacket & {
  status: PaymentStatus;
  total: number | string;
  amount_total: string | number;
};

export type CreatorPaymentPage = {
  payments: PaymentRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    pendingCount: number;
    paidCount: number;
    pendingAmount: string;
    paidAmount: string;
    totalAmount: string;
  };
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function listCreatorPaymentsPage(
  creatorId: number,
  filters: CreatorPaymentFilters,
): Promise<CreatorPaymentPage> {
  const where = ["cr.creator_id = ?"];
  const params: Array<string | number> = [creatorId];

  if (filters.status && filters.status !== "all") {
    where.push("p.status = ?");
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

  const [rows, countRows, summaryRows] = await Promise.all([
    query<PaymentRow[]>(
      `${paymentSelect}
       ${whereSql}
       ORDER BY p.payment_date IS NULL, p.payment_date DESC,
                p.payment_id DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.pageSize, offset],
    ),
    query<PaymentCountRow[]>(
      `SELECT COUNT(*) AS total
       FROM payments p
       INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN creators cr ON cr.creator_id = a.creator_id
       INNER JOIN brands b ON b.brand_id = ca.brand_id
       ${whereSql}`,
      params,
    ),
    query<PaymentSummaryRow[]>(
      `SELECT p.status, COUNT(*) AS total,
              COALESCE(SUM(p.amount), 0) AS amount_total
       FROM payments p
       INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.creator_id = ?
       GROUP BY p.status`,
      [creatorId],
    ),
  ]);

  const summary = {
    pendingCount: 0,
    paidCount: 0,
    pendingAmount: "0",
    paidAmount: "0",
    totalAmount: "0",
  };

  for (const row of summaryRows) {
    if (row.status === "Pending") {
      summary.pendingCount = Number(row.total);
      summary.pendingAmount = String(row.amount_total);
    } else {
      summary.paidCount = Number(row.total);
      summary.paidAmount = String(row.amount_total);
    }
  }

  summary.totalAmount = addDecimalStrings(
    summary.pendingAmount,
    summary.paidAmount,
  );

  const total = Number(countRows[0]?.total ?? 0);

  return {
    payments: rows.map(mapPayment),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    summary,
  };
}

export async function listPaymentsForParty(input: {
  collaborationId: number;
  role: Role;
  profileId: number | null;
}): Promise<PaymentRecord[]> {
  await lockCollaborationForRead(input);
  const rows = await query<PaymentRow[]>(
    `${paymentSelect}
     WHERE co.collaboration_id = ?
     ORDER BY p.payment_id DESC`,
    [input.collaborationId],
  );
  return rows.map(mapPayment);
}

async function lockCollaboration(
  connection: PoolConnection,
  collaborationId: number,
): Promise<OwnedCollaborationRow | undefined> {
  const [rows] = await connection.execute<OwnedCollaborationRow[]>(
    `SELECT co.collaboration_id, a.creator_id, ca.brand_id,
            co.agreed_amount, co.status
     FROM collaborations co
     INNER JOIN applications a ON a.application_id = co.application_id
     INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
     WHERE co.collaboration_id = ?
     FOR UPDATE`,
    [collaborationId],
  );
  return rows[0];
}

function canAccess(
  row: Pick<OwnedCollaborationRow, "creator_id" | "brand_id">,
  role: Role,
  profileId: number | null,
): boolean {
  return (
    role === "Admin" ||
    (role === "Creator" && profileId === row.creator_id) ||
    (role === "Brand" && profileId === row.brand_id)
  );
}

function decimalToMinorUnits(value: string | number): bigint {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

function addDecimalStrings(left: string, right: string): string {
  const total = decimalToMinorUnits(left) + decimalToMinorUnits(right);
  const whole = total / 100n;
  const fraction = (total % 100n).toString().padStart(2, "0");

  return `${whole}.${fraction}`;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as MysqlError).code === "ER_DUP_ENTRY"
  );
}

async function rollbackOrDestroy(connection: PoolConnection): Promise<void> {
  try {
    await connection.rollback();
  } catch (error) {
    connection.destroy();
    console.error(
      "Finance transaction rollback failed; connection discarded:",
      error instanceof Error ? error.message : "Unknown error",
    );
    throw error;
  }
}

export async function createPayment(input: {
  brandId: number;
  collaborationId: number;
  payment: PaymentCreateInput;
}): Promise<{ paymentId: number; collaborationStatus: "Active" | "Completed" }> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;
  try {
    await connection.beginTransaction();
    const collaboration = await lockCollaboration(
      connection,
      input.collaborationId,
    );
    if (!collaboration || collaboration.brand_id !== input.brandId) {
      throw new FinanceError(
        "COLLABORATION_NOT_FOUND",
        "This collaboration could not be found.",
      );
    }
    if (
      collaboration.agreed_amount === null ||
      decimalToMinorUnits(input.payment.amount) !==
        decimalToMinorUnits(collaboration.agreed_amount)
    ) {
      throw new FinanceError(
        "PAYMENT_AMOUNT_MISMATCH",
        "Payment amount must equal the agreed collaboration amount. Partial payments are not supported.",
      );
    }

    const [existingRows] = await connection.execute<RowDataPacket[]>(
      `SELECT payment_id
       FROM payments
       WHERE collaboration_id = ?
       LIMIT 1
       FOR UPDATE`,
      [input.collaborationId],
    );
    if (existingRows.length > 0) {
      throw new FinanceError(
        "PAYMENT_EXISTS",
        "A settlement payment already exists for this collaboration.",
      );
    }
    if (
      input.payment.status === "Pending" &&
      collaboration.status !== "Active"
    ) {
      throw new FinanceError(
        "COLLABORATION_COMPLETED",
        "A pending payment cannot be created for a completed collaboration.",
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO payments (collaboration_id, amount, payment_date, status)
       VALUES (?, ?, ?, ?)`,
      [
        input.collaborationId,
        input.payment.amount,
        input.payment.paymentDate,
        input.payment.status,
      ],
    );
    const [statusRows] = await connection.execute<
      Array<RowDataPacket & { status: "Active" | "Completed" }>
    >(
      `SELECT status
       FROM collaborations
       WHERE collaboration_id = ?
       LIMIT 1`,
      [input.collaborationId],
    );
    const updatedStatus = statusRows[0]?.status;
    if (!updatedStatus) {
      throw new FinanceError(
        "COLLABORATION_NOT_FOUND",
        "The collaboration status could not be loaded after payment creation.",
      );
    }
    await connection.commit();
    return { paymentId: result.insertId, collaborationStatus: updatedStatus };
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Payment creation rollback failed:",
        rollbackError instanceof Error ? rollbackError.message : "Unknown error",
      );
    }
    if (isDuplicateKey(error)) {
      throw new FinanceError(
        "PAYMENT_EXISTS",
        "A settlement payment already exists for this collaboration.",
      );
    }
    throw error;
  } finally {
    if (!connectionDestroyed) connection.release();
  }
}

export async function updatePayment(input: {
  paymentId: number;
  role: "Brand" | "Admin";
  brandId: number | null;
  updates: PaymentUpdateInput;
}): Promise<{ paymentId: number; status: PaymentStatus; collaborationStatus: "Active" | "Completed" }> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;
  try {
    await connection.beginTransaction();
    const [paymentKeyRows] = await connection.execute<PaymentKeyRow[]>(
      `SELECT payment_id, collaboration_id
       FROM payments
       WHERE payment_id = ?
       LIMIT 1`,
      [input.paymentId],
    );
    const paymentKey = paymentKeyRows[0];
    if (!paymentKey) {
      throw new FinanceError("PAYMENT_NOT_FOUND", "This payment could not be found.");
    }

    const collaboration = await lockCollaboration(
      connection,
      paymentKey.collaboration_id,
    );
    if (
      !collaboration ||
      (input.role === "Brand" && collaboration.brand_id !== input.brandId)
    ) {
      throw new FinanceError("PAYMENT_NOT_FOUND", "This payment could not be found.");
    }

    const [paymentRows] = await connection.execute<LockedPaymentRow[]>(
      `SELECT payment_id, collaboration_id, amount, payment_date, status
       FROM payments
       WHERE payment_id = ? AND collaboration_id = ?
       FOR UPDATE`,
      [input.paymentId, paymentKey.collaboration_id],
    );
    const payment = paymentRows[0];
    if (!payment) {
      throw new FinanceError("PAYMENT_NOT_FOUND", "This payment could not be found.");
    }
    if (payment.status === "Paid" && input.updates.status !== undefined) {
      throw new FinanceError(
        "INVALID_PAYMENT_TRANSITION",
        "Paid payments cannot be changed back to Pending or marked paid again.",
      );
    }
    if (
      input.updates.status === "Paid" &&
      input.updates.paymentDate === undefined &&
      payment.payment_date === null
    ) {
      throw new FinanceError(
        "INVALID_PAYMENT_TRANSITION",
        "A payment date is required before marking this payment paid.",
      );
    }

    const nextDate =
      input.updates.paymentDate === undefined
        ? payment.payment_date
        : input.updates.paymentDate;
    if (input.updates.status === "Paid" && !nextDate) {
      throw new FinanceError(
        "INVALID_PAYMENT_TRANSITION",
        "A payment date is required before marking this payment paid.",
      );
    }

    const nextStatus = input.updates.status ?? payment.status;
    if (nextStatus === "Paid" && !nextDate) {
      throw new FinanceError(
        "INVALID_PAYMENT_TRANSITION",
        "Paid payments must have a payment date.",
      );
    }
    await connection.execute<ResultSetHeader>(
      `UPDATE payments
       SET payment_date = ?, status = ?
       WHERE payment_id = ?`,
      [nextDate, nextStatus, input.paymentId],
    );
    const [statusRows] = await connection.execute<
      Array<RowDataPacket & { status: "Active" | "Completed" }>
    >(
      `SELECT status
       FROM collaborations
       WHERE collaboration_id = ?
       LIMIT 1`,
      [paymentKey.collaboration_id],
    );
    const collaborationStatus = statusRows[0]?.status;
    if (!collaborationStatus) {
      throw new FinanceError(
        "COLLABORATION_NOT_FOUND",
        "The collaboration status could not be loaded after payment update.",
      );
    }
    await connection.commit();
    return {
      paymentId: input.paymentId,
      status: nextStatus,
      collaborationStatus,
    };
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Payment update rollback failed:",
        rollbackError instanceof Error ? rollbackError.message : "Unknown error",
      );
    }
    throw error;
  } finally {
    if (!connectionDestroyed) connection.release();
  }
}

async function lockOwnedCollaboration(
  connection: PoolConnection,
  collaborationId: number,
  role: "Brand" | "Admin",
  profileId: number | null,
): Promise<OwnedCollaborationRow> {
  const collaboration = await lockCollaboration(connection, collaborationId);
  if (!collaboration || !canAccess(collaboration, role, profileId)) {
    throw new FinanceError(
      "COLLABORATION_NOT_FOUND",
      "This collaboration could not be found.",
    );
  }
  return collaboration;
}

async function lockCollaborationForRead(input: {
  collaborationId: number;
  role: Role;
  profileId: number | null;
}): Promise<OwnedCollaborationRow> {
  const rows = await query<OwnedCollaborationRow[]>(
    `SELECT co.collaboration_id, a.creator_id, ca.brand_id,
            co.agreed_amount, co.status
     FROM collaborations co
     INNER JOIN applications a ON a.application_id = co.application_id
     INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
     WHERE co.collaboration_id = ?
     LIMIT 1`,
    [input.collaborationId],
  );
  const collaboration = rows[0];
  if (!collaboration || !canAccess(collaboration, input.role, input.profileId)) {
    throw new FinanceError(
      "COLLABORATION_NOT_FOUND",
      "This collaboration could not be found.",
    );
  }
  return collaboration;
}

export async function getMetricsForParty(input: {
  collaborationId: number;
  role: Role;
  profileId: number | null;
}): Promise<MetricsRecord | null> {
  await lockCollaborationForRead(input);
  const rows = await query<MetricsRow[]>(
    `SELECT collaboration_id, views, likes, comments, shares, clicks
     FROM performance_metrics
     WHERE collaboration_id = ?
     LIMIT 1`,
    [input.collaborationId],
  );
  return rows[0] ? mapMetrics(rows[0]) : null;
}

export async function upsertMetrics(input: {
  collaborationId: number;
  role: "Brand" | "Admin";
  profileId: number | null;
  metrics: MetricsUpsertInput;
}): Promise<MetricsRecord> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;
  try {
    await connection.beginTransaction();
    await lockOwnedCollaboration(
      connection,
      input.collaborationId,
      input.role,
      input.profileId,
    );
    await connection.execute<ResultSetHeader>(
      `INSERT INTO performance_metrics
         (collaboration_id, views, likes, comments, shares, clicks)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         views = VALUES(views), likes = VALUES(likes),
         comments = VALUES(comments), shares = VALUES(shares),
         clicks = VALUES(clicks)`,
      [
        input.collaborationId,
        input.metrics.views,
        input.metrics.likes,
        input.metrics.comments,
        input.metrics.shares,
        input.metrics.clicks,
      ],
    );
    const [metricsRows] = await connection.execute<MetricsRow[]>(
      `SELECT collaboration_id, views, likes, comments, shares, clicks
       FROM performance_metrics
       WHERE collaboration_id = ?
       LIMIT 1`,
      [input.collaborationId],
    );
    const savedMetrics = metricsRows[0];
    if (!savedMetrics) {
      throw new FinanceError("METRICS_NOT_FOUND", "Metrics could not be loaded.");
    }
    await connection.commit();
    return mapMetrics(savedMetrics);
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Metrics upsert rollback failed:",
        rollbackError instanceof Error ? rollbackError.message : "Unknown error",
      );
    }
    throw error;
  } finally {
    if (!connectionDestroyed) connection.release();
  }
}

export async function getReviewForParty(input: {
  collaborationId: number;
  role: Role;
  profileId: number | null;
}): Promise<ReviewRecord | null> {
  await lockCollaborationForRead(input);
  const rows = await query<ReviewRow[]>(
    `SELECT review_id, collaboration_id, rating, feedback, review_date
     FROM reviews
     WHERE collaboration_id = ?
     LIMIT 1`,
    [input.collaborationId],
  );
  return rows[0] ? mapReview(rows[0]) : null;
}

export async function upsertReview(input: {
  collaborationId: number;
  brandId: number;
  review: ReviewUpsertInput;
}): Promise<ReviewRecord> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;
  try {
    await connection.beginTransaction();
    const collaboration = await lockOwnedCollaboration(
      connection,
      input.collaborationId,
      "Brand",
      input.brandId,
    );
    if (collaboration.status !== "Completed") {
      throw new FinanceError(
        "REVIEW_REQUIRES_COMPLETION",
        "A review can be submitted after the collaboration is completed.",
      );
    }
    await connection.execute<ResultSetHeader>(
      `INSERT INTO reviews (collaboration_id, rating, feedback, review_date)
       VALUES (?, ?, ?, CURRENT_DATE)
       ON DUPLICATE KEY UPDATE
         rating = VALUES(rating), feedback = VALUES(feedback),
         review_date = CURRENT_DATE`,
      [
        input.collaborationId,
        input.review.rating,
        input.review.feedback || null,
      ],
    );
    const [reviewRows] = await connection.execute<ReviewRow[]>(
      `SELECT review_id, collaboration_id, rating, feedback, review_date
       FROM reviews
       WHERE collaboration_id = ?
       LIMIT 1`,
      [input.collaborationId],
    );
    const savedReview = reviewRows[0];
    if (!savedReview) {
      throw new FinanceError("REVIEW_NOT_FOUND", "The review could not be loaded.");
    }
    await connection.commit();
    return mapReview(savedReview);
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Review upsert rollback failed:",
        rollbackError instanceof Error ? rollbackError.message : "Unknown error",
      );
    }
    throw error;
  } finally {
    if (!connectionDestroyed) connection.release();
  }
}

export async function deleteReview(reviewId: number): Promise<void> {
  const result = await pool.execute<ResultSetHeader>(
    `DELETE FROM reviews
     WHERE review_id = ?`,
    [reviewId],
  );
  if (result[0].affectedRows !== 1) {
    throw new FinanceError("REVIEW_NOT_FOUND", "This review could not be found.");
  }
}
