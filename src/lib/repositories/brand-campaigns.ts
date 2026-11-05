import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { pool } from "@/lib/db";
import type {
  BrandCampaignCreateInput,
  BrandCampaignUpdateInput,
} from "@/lib/validations/campaigns";

export type BrandCampaignRecord = {
  campaignId: number;
  campaignName: string;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  budget: string;
  minFollowers: number;
  startDate: string;
  endDate: string;
  status: "Open" | "Ongoing" | "Completed";
  creatorLimit: number;
  applicationCount: number;
  pendingApplicationCount: number;
  acceptedApplicationCount: number;
};

export type CampaignCategoryOption = {
  categoryId: number;
  categoryName: string;
};

type CampaignRow = RowDataPacket & {
  campaign_id: number;
  campaign_name: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  budget: string | number;
  min_followers: number | string | null;
  start_date: string;
  end_date: string;
  status: "Open" | "Ongoing" | "Completed";
  creator_limit: number | string | null;
  application_count: number | string;
  pending_application_count: number | string;
  accepted_application_count: number | string;
};

type CategoryRow = RowDataPacket & {
  category_id: number;
  category_name: string;
};

type OwnedCampaignRow = RowDataPacket & {
  campaign_id: number;
  category_id: number | null;
  start_date: string;
  end_date: string;
};

export class BrandCampaignError extends Error {
  constructor(
    readonly code:
      | "CAMPAIGN_NOT_FOUND"
      | "CATEGORY_NOT_FOUND"
      | "INVALID_DATE_RANGE",
    message: string,
  ) {
    super(message);
    this.name = "BrandCampaignError";
  }
}

function mapCampaign(row: CampaignRow): BrandCampaignRecord {
  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    budget: String(row.budget),
    minFollowers: Number(row.min_followers ?? 0),
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    creatorLimit: Number(row.creator_limit ?? 1),
    applicationCount: Number(row.application_count),
    pendingApplicationCount: Number(row.pending_application_count),
    acceptedApplicationCount: Number(row.accepted_application_count),
  };
}

const campaignSelect = `SELECT ca.campaign_id, ca.campaign_name, ca.description,
       ca.category_id, cc.category_name, ca.budget, ca.min_followers,
       ca.start_date, ca.end_date, ca.status, ca.creator_limit,
       COUNT(CASE WHEN request_collab.collaboration_id IS NULL
                  THEN a.application_id END) AS application_count,
       COALESCE(SUM(CASE
         WHEN request_collab.collaboration_id IS NULL AND a.status = 'Pending'
         THEN 1 ELSE 0 END), 0) AS pending_application_count,
       COALESCE(SUM(CASE
         WHEN request_collab.collaboration_id IS NULL AND a.status = 'Accepted'
         THEN 1 ELSE 0 END), 0) AS accepted_application_count
FROM campaigns ca
LEFT JOIN campaign_categories cc ON cc.category_id = ca.category_id
LEFT JOIN applications a ON a.campaign_id = ca.campaign_id
LEFT JOIN collaborations request_collab
  ON request_collab.application_id = a.application_id
 AND request_collab.requested_by IS NOT NULL`;

export async function listBrandCampaigns(
  brandId: number,
): Promise<BrandCampaignRecord[]> {
  const [rows] = await pool.execute<CampaignRow[]>(
    `${campaignSelect}
     WHERE ca.brand_id = ?
     GROUP BY ca.campaign_id, ca.campaign_name, ca.description,
              ca.category_id, cc.category_name, ca.budget, ca.min_followers,
              ca.start_date, ca.end_date, ca.status, ca.creator_limit
     ORDER BY ca.start_date DESC, ca.campaign_id DESC`,
    [brandId],
  );
  return rows.map(mapCampaign);
}

export async function listCampaignCategoryOptions(): Promise<
  CampaignCategoryOption[]
> {
  const [rows] = await pool.execute<CategoryRow[]>(
    `SELECT category_id, category_name
     FROM campaign_categories
     ORDER BY category_name ASC, category_id ASC`,
  );
  return rows.map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
  }));
}

async function validateCategory(
  connection: PoolConnection,
  categoryId: number | null | undefined,
): Promise<void> {
  if (categoryId == null) return;

  const [rows] = await connection.execute<CategoryRow[]>(
    `SELECT category_id, category_name
     FROM campaign_categories
     WHERE category_id = ?
     LIMIT 1`,
    [categoryId],
  );
  if (!rows[0]) {
    throw new BrandCampaignError(
      "CATEGORY_NOT_FOUND",
      "The selected campaign category could not be found.",
    );
  }
}

async function rollbackOrDestroy(connection: PoolConnection): Promise<void> {
  try {
    await connection.rollback();
  } catch (error) {
    connection.destroy();
    console.error(
      "Brand campaign transaction rollback failed; connection discarded:",
      error instanceof Error ? error.message : "Unknown error",
    );
    throw error;
  }
}

export async function createBrandCampaign(
  brandId: number,
  input: BrandCampaignCreateInput,
): Promise<number> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    await validateCategory(connection, input.categoryId);
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO campaigns
         (brand_id, category_id, campaign_name, description, budget,
          min_followers, start_date, end_date, status, max_creators,
          creator_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)`,
      [
        brandId,
        input.categoryId ?? null,
        input.campaignName,
        input.description ?? null,
        input.budget,
        input.minFollowers,
        input.startDate,
        input.endDate,
        input.creatorLimit,
        input.creatorLimit,
      ],
    );
    await connection.commit();
    return result.insertId;
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch {
      connectionDestroyed = true;
      throw error;
    }
    throw error;
  } finally {
    if (!connectionDestroyed) connection.release();
  }
}

export async function updateBrandCampaign(
  brandId: number,
  campaignId: number,
  input: BrandCampaignUpdateInput,
): Promise<void> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<OwnedCampaignRow[]>(
      `SELECT campaign_id, category_id, start_date, end_date
       FROM campaigns
       WHERE campaign_id = ? AND brand_id = ?
       FOR UPDATE`,
      [campaignId, brandId],
    );
    const campaign = rows[0];
    if (!campaign) {
      throw new BrandCampaignError(
        "CAMPAIGN_NOT_FOUND",
        "The campaign could not be found.",
      );
    }

    await validateCategory(connection, input.categoryId ?? campaign.category_id);
    const startDate = input.startDate ?? campaign.start_date;
    const endDate = input.endDate ?? campaign.end_date;
    if (endDate < startDate) {
      throw new BrandCampaignError(
        "INVALID_DATE_RANGE",
        "End date must be on or after the start date.",
      );
    }

    const updates: string[] = [];
    const values: Array<string | number | null> = [];
    if (input.campaignName !== undefined) {
      updates.push("campaign_name = ?");
      values.push(input.campaignName);
    }
    if (input.description !== undefined) {
      updates.push("description = ?");
      values.push(input.description);
    }
    if (input.categoryId !== undefined) {
      updates.push("category_id = ?");
      values.push(input.categoryId);
    }
    if (input.budget !== undefined) {
      updates.push("budget = ?");
      values.push(input.budget);
    }
    if (input.minFollowers !== undefined) {
      updates.push("min_followers = ?");
      values.push(input.minFollowers);
    }
    if (input.creatorLimit !== undefined) {
      updates.push("max_creators = ?", "creator_limit = ?");
      values.push(input.creatorLimit, input.creatorLimit);
    }
    if (input.startDate !== undefined) {
      updates.push("start_date = ?");
      values.push(input.startDate);
    }
    if (input.endDate !== undefined) {
      updates.push("end_date = ?");
      values.push(input.endDate);
    }
    if (input.status !== undefined) {
      updates.push("status = ?");
      values.push(input.status);
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE campaigns SET ${updates.join(", ")}
       WHERE campaign_id = ? AND brand_id = ?`,
      [...values, campaignId, brandId],
    );
    await connection.commit();
  } catch (error) {
    try {
      await rollbackOrDestroy(connection);
    } catch {
      connectionDestroyed = true;
      throw error;
    }
    throw error;
  } finally {
    if (!connectionDestroyed) connection.release();
  }
}
