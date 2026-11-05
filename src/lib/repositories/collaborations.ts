import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { pool, query } from "@/lib/db";
import type { Role } from "@/lib/auth/constants";
import type { CollaborationUpdateInput } from "@/lib/validations/collaborations";

export type CollaborationStatus =
  | "Pending"
  | "Active"
  | "Completed"
  | "Rejected";

export type CollaborationListStatus = "Active" | "Completed";

export type CollaborationRequestedBy = "Brand" | "Creator";

type CollaborationRow = RowDataPacket & {
  collaboration_id: number;
  application_id: number;
  title: string;
  description: string | null;
  deliverable_description: string | null;
  additional_requirements: string | null;
  requested_by: CollaborationRequestedBy | null;
  created_at: string | null;
  decided_at: string | null;
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
  deliverable_count: number | string;
  completed_deliverable_count: number | string;
  next_due_date: string | null;
};

export type CollaborationRecord = {
  collaborationId: number;
  applicationId: number;
  title: string;
  description: string | null;
  deliverableDescription: string | null;
  additionalRequirements: string | null;
  requestedBy: CollaborationRequestedBy | null;
  createdAt: string | null;
  decidedAt: string | null;
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
  deliverableCount: number;
  completedDeliverableCount: number;
  pendingDeliverableCount: number;
  nextDueDate: string | null;
};

function mapCollaboration(row: CollaborationRow): CollaborationRecord {
  const deliverableCount = Number(row.deliverable_count);
  const completedDeliverableCount = Number(row.completed_deliverable_count);

  return {
    collaborationId: row.collaboration_id,
    applicationId: row.application_id,
    title: row.title || row.campaign_name,
    description: row.description,
    deliverableDescription: row.deliverable_description,
    additionalRequirements: row.additional_requirements,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
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
    deliverableCount,
    completedDeliverableCount,
    pendingDeliverableCount: Math.max(
      0,
      deliverableCount - completedDeliverableCount,
    ),
    nextDueDate: row.next_due_date,
  };
}

const collaborationSelect = `SELECT co.collaboration_id, co.application_id,
       COALESCE(co.title, ca.campaign_name) AS title,
       co.description, co.deliverable_description,
       co.additional_requirements, co.requested_by,
       co.created_at, co.decided_at,
       cr.creator_id, cr.first_name AS creator_first_name,
       cr.last_name AS creator_last_name, creator_user.username AS creator_username,
       b.brand_id, b.brand_name, ca.campaign_id, ca.campaign_name,
       co.agreed_amount, co.start_date, co.end_date, co.status,
       (SELECT COUNT(*) FROM deliverables d
        WHERE d.collaboration_id = co.collaboration_id) AS deliverable_count,
       (SELECT COUNT(*) FROM deliverables d
        WHERE d.collaboration_id = co.collaboration_id
          AND d.status = 'Completed') AS completed_deliverable_count,
       (SELECT MIN(d.due_date) FROM deliverables d
        WHERE d.collaboration_id = co.collaboration_id
          AND d.status = 'Pending') AS next_due_date
FROM collaborations co
INNER JOIN applications a ON a.application_id = co.application_id
INNER JOIN creators cr ON cr.creator_id = a.creator_id
INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
INNER JOIN brands b ON b.brand_id = ca.brand_id`;

type CollaborationCountRow = RowDataPacket & {
  total: number | string;
};

type CollaborationStatusCountRow = RowDataPacket & {
  status: CollaborationStatus;
  total: number | string;
};

export type CreatorCollaborationFilters = {
  q?: string;
  status?: CollaborationListStatus | "all";
  page: number;
  pageSize: number;
};

export type CreatorCollaborationPage = {
  collaborations: CollaborationRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts: Record<CollaborationListStatus, number>;
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function listCreatorCollaborationsPage(
  creatorId: number,
  filters: CreatorCollaborationFilters,
): Promise<CreatorCollaborationPage> {
  const where = ["cr.creator_id = ?", "co.status IN ('Active', 'Completed')"];
  const params: Array<string | number> = [creatorId];

  if (filters.status && filters.status !== "all") {
    where.push("co.status = ?");
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
    query<CollaborationRow[]>(
      `${collaborationSelect}
       ${whereSql}
       ORDER BY co.start_date DESC, co.collaboration_id DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.pageSize, offset],
    ),
    query<CollaborationCountRow[]>(
      `SELECT COUNT(*) AS total
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN creators cr ON cr.creator_id = a.creator_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN brands b ON b.brand_id = ca.brand_id
       ${whereSql}`,
      params,
    ),
    query<CollaborationStatusCountRow[]>(
      `SELECT co.status, COUNT(*) AS total
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.creator_id = ?\r\n         AND co.status IN ('Active', 'Completed')\r\n       GROUP BY co.status`,
      [creatorId],
    ),
  ]);

  const statusCounts: Record<CollaborationListStatus, number> = {
    Active: 0,
    Completed: 0,
  };

  for (const row of statusRows) {
    statusCounts[row.status as CollaborationListStatus] = Number(row.total);
  }

  const total = Number(countRows[0]?.total ?? 0);

  return {
    collaborations: rows.map(mapCollaboration),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    statusCounts,
  };
}

export async function listCreatorCollaborations(
  creatorId: number,
): Promise<CollaborationRecord[]> {
  const rows = await query<CollaborationRow[]>(
    `${collaborationSelect}
     WHERE cr.creator_id = ?\r\n       AND co.status IN ('Active', 'Completed')\r\n     ORDER BY co.start_date DESC, co.collaboration_id DESC`,
    [creatorId],
  );

  return rows.map(mapCollaboration);
}

export async function listBrandCollaborations(
  brandId: number,
): Promise<CollaborationRecord[]> {
  const rows = await query<CollaborationRow[]>(
    `${collaborationSelect}
     WHERE b.brand_id = ?\r\n       AND co.status IN ('Active', 'Completed')\r\n     ORDER BY co.start_date DESC, co.collaboration_id DESC`,
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
     WHERE co.collaboration_id = ?\r\n       AND co.status IN ('Active', 'Completed')\r\n     LIMIT 1`,
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

    if (
      collaboration.status !== "Active" &&
      collaboration.status !== "Completed"
    ) {
      throw new CollaborationUpdateError(
        "INVALID_STATUS_TRANSITION",
        "Pending collaboration requests must be accepted or rejected from the requests section.",
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

export type CampaignRequestOption = {
  campaignId: number;
  campaignName: string;
  brandId: number;
  brandName: string;
  startDate: string;
  endDate: string;
  budget: string;
};

export type CreatorRequestOption = {
  creatorId: number;
  creatorName: string;
  creatorUsername: string;
  city: string | null;
};

export type BrandRequestOption = {
  brandId: number;
  brandName: string;
  industry: string | null;
  city: string | null;
};

export type CollaborationRequestOptions = {
  campaigns: CampaignRequestOption[];
  creators: CreatorRequestOption[];
  brands: BrandRequestOption[];
};

export type CollaborationRequestInbox = {
  incoming: CollaborationRecord[];
  outgoing: CollaborationRecord[];
  options: CollaborationRequestOptions;
};

export type CreateCollaborationRequestInput = {
  title: string;
  description: string | null;
  deliverableDescription: string;
  additionalRequirements: string | null;
  agreedAmount: string;
  startDate: string;
  endDate: string;
  campaignId: number;
  brandId?: number | null;
  creatorId: number | null;
};

export type CollaborationRequestErrorCode =
  | "REQUEST_NOT_FOUND"
  | "REQUEST_ACCESS_DENIED"
  | "REQUEST_CAMPAIGN_NOT_FOUND"
  | "REQUEST_CAMPAIGN_CLOSED"
  | "REQUEST_CREATOR_NOT_FOUND"
  | "REQUEST_BRAND_NOT_FOUND"
  | "REQUEST_DUPLICATE"
  | "REQUEST_ALREADY_DECIDED";

export class CollaborationRequestError extends Error {
  constructor(
    readonly code: CollaborationRequestErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CollaborationRequestError";
  }
}

type CampaignOptionRow = RowDataPacket & {
  campaign_id: number;
  campaign_name: string;
  brand_id: number;
  brand_name: string;
  start_date: string;
  end_date: string;
  budget: string | number;
};

type CreatorOptionRow = RowDataPacket & {
  creator_id: number;
  creator_name: string;
  creator_username: string;
  city: string | null;
};

type BrandOptionRow = RowDataPacket & {
  brand_id: number;
  brand_name: string;
  industry: string | null;
  city: string | null;
};

type RequestCampaignRow = RowDataPacket & {
  campaign_id: number;
  campaign_name: string;
  brand_id: number;
  status: "Open" | "Ongoing" | "Completed";
};

type RequestCreatorRow = RowDataPacket & {
  creator_id: number;
};

type RequestBrandRow = RowDataPacket & {
  brand_id: number;
};

type LockedRequestRow = RowDataPacket & {
  collaboration_id: number;
  application_id: number;
  creator_id: number;
  brand_id: number;
  requested_by: CollaborationRequestedBy | null;
  status: CollaborationStatus;
};

function isDuplicateEntry(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "ER_DUP_ENTRY"
  );
}

async function getCollaborationRequestById(
  collaborationId: number,
): Promise<CollaborationRecord | null> {
  const rows = await query<CollaborationRow[]>(
    `${collaborationSelect}
     WHERE co.collaboration_id = ?
     LIMIT 1`,
    [collaborationId],
  );

  return rows[0] ? mapCollaboration(rows[0]) : null;
}

export async function listCollaborationRequestOptions(input: {
  role: Role;
  brandId: number | null;
}): Promise<CollaborationRequestOptions> {
  const campaignWhere =
    input.role === "Brand"
      ? "WHERE ca.brand_id = ? AND ca.status IN ('Open', 'Ongoing')"
      : "WHERE ca.status IN ('Open', 'Ongoing')";
  const campaignParams = input.role === "Brand" ? [input.brandId] : [];

  const [campaigns, creators, brands] = await Promise.all([
    query<CampaignOptionRow[]>(
      `SELECT ca.campaign_id, ca.campaign_name, b.brand_id, b.brand_name,
              ca.start_date, ca.end_date, ca.budget
       FROM campaigns ca
       INNER JOIN brands b ON b.brand_id = ca.brand_id
       ${campaignWhere}
       ORDER BY ca.start_date DESC, ca.campaign_id DESC
       LIMIT 200`,
      campaignParams,
    ),
    input.role === "Creator"
      ? Promise.resolve([] as CreatorOptionRow[])
      : query<CreatorOptionRow[]>(
          `SELECT cr.creator_id,
                  CONCAT_WS(' ', cr.first_name, cr.last_name) AS creator_name,
                  u.username AS creator_username, cr.city
           FROM creators cr
           INNER JOIN users u ON u.user_id = cr.user_id
           ORDER BY cr.first_name, cr.last_name
           LIMIT 200`,
        ),
    input.role === "Brand"
      ? Promise.resolve([] as BrandOptionRow[])
      : query<BrandOptionRow[]>(
          `SELECT b.brand_id, b.brand_name, b.industry, b.city
           FROM brands b
           ORDER BY b.brand_name ASC
           LIMIT 200`,
        ),
  ]);

  return {
    campaigns: campaigns.map((row) => ({
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      brandId: row.brand_id,
      brandName: row.brand_name,
      startDate: row.start_date,
      endDate: row.end_date,
      budget: String(row.budget),
    })),
    creators: creators.map((row) => ({
      creatorId: row.creator_id,
      creatorName: row.creator_name,
      creatorUsername: row.creator_username,
      city: row.city,
    })),
    brands: brands.map((row) => ({
      brandId: row.brand_id,
      brandName: row.brand_name,
      industry: row.industry,
      city: row.city,
    })),
  };
}

export async function listCollaborationRequestsForActor(input: {
  role: Role;
  brandId: number | null;
  creatorId: number | null;
}): Promise<{ incoming: CollaborationRecord[]; outgoing: CollaborationRecord[] }> {
  const incomingWhere: string[] = [
    "co.requested_by IS NOT NULL",
    "co.status = 'Pending'",
  ];
  const incomingParams: number[] = [];

  if (input.role === "Creator") {
    if (input.creatorId === null) {
      return { incoming: [], outgoing: [] };
    }
    incomingWhere.push("co.requested_by = 'Brand'", "a.creator_id = ?");
    incomingParams.push(input.creatorId);
  } else if (input.role === "Brand") {
    if (input.brandId === null) {
      return { incoming: [], outgoing: [] };
    }
    incomingWhere.push("co.requested_by = 'Creator'", "ca.brand_id = ?");
    incomingParams.push(input.brandId);
  }

  const outgoingWhere: string[] = ["co.requested_by IS NOT NULL"];
  const outgoingParams: number[] = [];

  if (input.role === "Creator") {
    if (input.creatorId === null) {
      return { incoming: [], outgoing: [] };
    }
    outgoingWhere.push("co.requested_by = 'Creator'", "a.creator_id = ?");
    outgoingParams.push(input.creatorId);
  } else if (input.role === "Brand") {
    if (input.brandId === null) {
      return { incoming: [], outgoing: [] };
    }
    outgoingWhere.push("co.requested_by = 'Brand'", "ca.brand_id = ?");
    outgoingParams.push(input.brandId);
  } else {
    return { incoming: [], outgoing: [] };
  }

  const [incomingRows, outgoingRows] = await Promise.all([
    query<CollaborationRow[]>(
      `${collaborationSelect}
       WHERE ${incomingWhere.join(" AND ")}
       ORDER BY co.created_at DESC, co.collaboration_id DESC
       LIMIT 100`,
      incomingParams,
    ),
    query<CollaborationRow[]>(
      `${collaborationSelect}
       WHERE ${outgoingWhere.join(" AND ")}
       ORDER BY co.created_at DESC, co.collaboration_id DESC
       LIMIT 50`,
      outgoingParams,
    ),
  ]);

  return {
    incoming: incomingRows.map(mapCollaboration),
    outgoing: outgoingRows.map(mapCollaboration),
  };
}

export async function createCollaborationRequest(input: {
  role: "Brand" | "Creator";
  brandId: number | null;
  creatorId: number | null;
  request: CreateCollaborationRequestInput;
}): Promise<CollaborationRecord> {
  const targetCreatorId =
    input.role === "Creator" ? input.creatorId : input.request.creatorId;

  if (targetCreatorId === null) {
    throw new CollaborationRequestError(
      "REQUEST_CREATOR_NOT_FOUND",
      "Choose a creator for this collaboration.",
    );
  }

  const connection = await pool.getConnection();
  let connectionDestroyed = false;
  let collaborationId = 0;

  try {
    await connection.beginTransaction();

    const selectedBrandId =
      input.role === "Brand" ? input.brandId : input.request.brandId;

    if (selectedBrandId === null) {
      throw new CollaborationRequestError(
        input.role === "Brand"
          ? "REQUEST_ACCESS_DENIED"
          : "REQUEST_BRAND_NOT_FOUND",
        input.role === "Brand"
          ? "You must have a brand profile to create collaborations."
          : "Choose a brand for this proposal.",
      );
    }

    if (input.role === "Creator") {
      const [brandRows] = await connection.query<RequestBrandRow[]>(
        `SELECT brand_id FROM brands WHERE brand_id = ? LIMIT 1`,
        [selectedBrandId],
      );
      if (!brandRows[0]) {
        throw new CollaborationRequestError(
          "REQUEST_BRAND_NOT_FOUND",
          "This brand could not be found.",
        );
      }
    }

    const [campaignRows] = await connection.execute<RequestCampaignRow[]>(
      `SELECT ca.campaign_id, ca.campaign_name, ca.brand_id, ca.status
       FROM campaigns ca
       WHERE ca.campaign_id = ?
       FOR UPDATE`,
      [input.request.campaignId],
    );
    const campaign = campaignRows[0];

    if (!campaign) {
      throw new CollaborationRequestError(
        "REQUEST_CAMPAIGN_NOT_FOUND",
        "This campaign could not be found.",
      );
    }

    if (campaign.brand_id !== selectedBrandId) {
      throw new CollaborationRequestError(
        input.role === "Brand"
          ? "REQUEST_ACCESS_DENIED"
          : "REQUEST_CAMPAIGN_NOT_FOUND",
        input.role === "Brand"
          ? "You can only create collaborations for your own campaigns."
          : "The selected campaign does not belong to this brand.",
      );
    }

    if (campaign.status === "Completed") {
      throw new CollaborationRequestError(
        "REQUEST_CAMPAIGN_CLOSED",
        "Completed campaigns cannot receive new collaboration requests.",
      );
    }

    const resolvedCampaignId = campaign.campaign_id;

    const [creatorRows] = await connection.execute<RequestCreatorRow[]>(
      `SELECT creator_id FROM creators WHERE creator_id = ? LIMIT 1`,
      [targetCreatorId],
    );

    if (!creatorRows[0]) {
      throw new CollaborationRequestError(
        "REQUEST_CREATOR_NOT_FOUND",
        "This creator could not be found.",
      );
    }

    const [applicationResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO applications (campaign_id, creator_id, status)
       VALUES (?, ?, 'Pending')`,
      [resolvedCampaignId, targetCreatorId],
    );

    const [collaborationResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO collaborations
         (application_id, title, description, deliverable_description,
          additional_requirements, requested_by, agreed_amount,
          start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        applicationResult.insertId,
        input.request.title,
        input.request.description,
        input.request.deliverableDescription,
        input.request.additionalRequirements,
        input.role,
        input.request.agreedAmount,
        input.request.startDate,
        input.request.endDate,
      ],
    );

    collaborationId = collaborationResult.insertId;
    await connection.commit();
  } catch (error) {
    const mappedError = isDuplicateEntry(error)
      ? new CollaborationRequestError(
          "REQUEST_DUPLICATE",
          "A collaboration or application already exists for this campaign and creator.",
        )
      : error;

    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Collaboration request creation failed and rollback also failed:",
        rollbackError instanceof Error
          ? rollbackError.message
          : "Unknown error",
      );
    }

    throw mappedError;
  } finally {
    if (!connectionDestroyed) {
      connection.release();
    }
  }

  const created = await getCollaborationRequestById(collaborationId);

  if (!created) {
    throw new CollaborationRequestError(
      "REQUEST_NOT_FOUND",
      "The collaboration request was created but could not be loaded.",
    );
  }

  return created;
}

export async function decideCollaborationRequest(input: {
  collaborationId: number;
  role: Role;
  brandId: number | null;
  creatorId: number | null;
  decision: "Accepted" | "Rejected";
}): Promise<CollaborationRecord> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<LockedRequestRow[]>(
      `SELECT co.collaboration_id, co.application_id, a.creator_id,
              ca.brand_id, co.requested_by, co.status
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE co.collaboration_id = ?
       FOR UPDATE`,
      [input.collaborationId],
    );
    const request = rows[0];

    if (!request) {
      throw new CollaborationRequestError(
        "REQUEST_NOT_FOUND",
        "This collaboration request could not be found.",
      );
    }

    const authorized =
      input.role === "Admin" ||
      (request.requested_by === "Brand" &&
        input.role === "Creator" &&
        input.creatorId === request.creator_id) ||
      (request.requested_by === "Creator" &&
        input.role === "Brand" &&
        input.brandId === request.brand_id);

    if (!authorized) {
      throw new CollaborationRequestError(
        "REQUEST_ACCESS_DENIED",
        "Only the recipient of this request can accept or reject it.",
      );
    }

    if (request.status !== "Pending") {
      throw new CollaborationRequestError(
        "REQUEST_ALREADY_DECIDED",
        "This collaboration request has already been decided.",
      );
    }

    const collaborationStatus =
      input.decision === "Accepted" ? "Active" : "Rejected";
    const applicationStatus = input.decision;

    await connection.execute<ResultSetHeader>(
      `UPDATE collaborations
       SET status = ?, decided_at = NOW()
       WHERE collaboration_id = ? AND status = 'Pending'`,
      [collaborationStatus, input.collaborationId],
    );

    await connection.execute<ResultSetHeader>(
      `UPDATE applications SET status = ? WHERE application_id = ?`,
      [applicationStatus, request.application_id],
    );

    await connection.commit();
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch (rollbackError) {
      connectionDestroyed = true;
      console.error(
        "Collaboration request decision failed and rollback also failed:",
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

  const decided = await getCollaborationRequestById(input.collaborationId);

  if (!decided) {
    throw new CollaborationRequestError(
      "REQUEST_NOT_FOUND",
      "The decided collaboration request could not be loaded.",
    );
  }

  return decided;
}
