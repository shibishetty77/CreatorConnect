import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { pool, query } from "@/lib/db";
import { formatNumber, formatPercent } from "@/lib/format";
import type { ApplicationStatus } from "@/lib/repositories/applications";

export type CampaignStatus = "Open" | "Ongoing" | "Completed";

type CampaignRow = RowDataPacket & {
  campaign_id: number;
  campaign_name: string;
  description: string | null;
  budget: string | number;
  min_followers: number | string;
  start_date: string | null;
  end_date: string | null;
  creator_limit: number | string;
  status: CampaignStatus;
  window_open: number | string;
  brand_name: string;
  category_name: string | null;
  application_status: ApplicationStatus | null;
  accepted_count: number | string;
};

type CampaignCountRow = RowDataPacket & {
  total: number | string;
};

type CampaignCategoryRow = RowDataPacket & {
  category_id: number;
  category_name: string;
};

type CampaignPlatformRow = RowDataPacket & {
  platform: string;
};

type RequirementRow = RowDataPacket & {
  campaign_id: number;
  requirement_id: number;
  platform: string | null;
  required_niche: string | null;
  min_engagement_rate: number | string | null;
};

type SocialAccountRow = RowDataPacket & {
  platform: string;
  followers: number | string;
  engagement_rate: number | string | null;
};

export type CampaignRequirementRecord = {
  requirementId: number;
  platform: string | null;
  requiredNiche: string | null;
  minEngagementRate: string | null;
};

export type CreatorSocialAccountEligibility = {
  platform: string;
  followers: number;
  engagementRate: number | null;
};

export type CampaignEligibilityInput = {
  minFollowers: number;
  requirements: CampaignRequirementRecord[];
  socialAccounts: CreatorSocialAccountEligibility[];
};

export type CreatorCampaignRecord = {
  campaignId: number;
  campaignName: string;
  description: string | null;
  budget: string;
  minFollowers: number;
  startDate: string | null;
  endDate: string | null;
  status: CampaignStatus;
  applicationWindowOpen: boolean;
  creatorLimit: number;
  acceptedApplications: number;
  remainingSlots: number;
  brandName: string;
  categoryName: string | null;
  applicationStatus: ApplicationStatus | null;
  requirements: CampaignRequirementRecord[];
  eligible: boolean;
  eligibilityReasons: string[];
};

export type CreatorCampaignFilters = {
  q?: string;
  categoryId?: number;
  platform?: string;
  minBudget?: number;
  maxBudget?: number;
  status?: CampaignStatus | "all";
  sort?: "newest" | "budget_desc" | "budget_asc";
  page: number;
  pageSize: number;
};

export type CreatorCampaignPage = {
  campaigns: CreatorCampaignRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CampaignFilterOptions = {
  categories: Array<{ categoryId: number; categoryName: string }>;
  platforms: string[];
};

function mapRequirement(row: RequirementRow): CampaignRequirementRecord {
  return {
    requirementId: row.requirement_id,
    platform: row.platform,
    requiredNiche: row.required_niche,
    minEngagementRate:
      row.min_engagement_rate === null
        ? null
        : String(row.min_engagement_rate),
  };
}

function accountMeetsRequirement(
  account: CreatorSocialAccountEligibility,
  minFollowers: number,
  requirement: CampaignRequirementRecord,
): boolean {
  if (
    requirement.platform &&
    account.platform.toLocaleLowerCase() !==
      requirement.platform.toLocaleLowerCase()
  ) {
    return false;
  }

  if (account.followers < minFollowers) {
    return false;
  }

  if (requirement.minEngagementRate !== null) {
    const minEngagementRate = Number(requirement.minEngagementRate);

    if (
      account.engagementRate === null ||
      account.engagementRate < minEngagementRate
    ) {
      return false;
    }
  }

  return true;
}

export function getCampaignEligibilityReasons(
  input: CampaignEligibilityInput,
): string[] {
  const { minFollowers, requirements, socialAccounts } = input;

  if (requirements.length === 0) {
    return socialAccounts.some((account) => account.followers >= minFollowers)
      ? []
      : [
          `At least one social account must have ${formatNumber(minFollowers)} or more followers.`,
        ];
  }

  return requirements.flatMap((requirement) => {
    const qualifiedAccountExists = socialAccounts.some((account) =>
      accountMeetsRequirement(account, minFollowers, requirement),
    );

    if (qualifiedAccountExists) {
      return [];
    }

    const platform = requirement.platform ?? "any platform";
    const engagementText =
      requirement.minEngagementRate === null
        ? ""
        : ` and ${formatPercent(requirement.minEngagementRate)} engagement`;

    return [
      `Add a ${platform} account with at least ${formatNumber(minFollowers)} followers${engagementText}.`,
    ];
  });
}

function mapCampaign(
  row: CampaignRow,
  requirements: CampaignRequirementRecord[],
  socialAccounts: CreatorSocialAccountEligibility[],
): CreatorCampaignRecord {
  const creatorLimit = Number(row.creator_limit);
  const acceptedApplications = Number(row.accepted_count);
  const minFollowers = Number(row.min_followers);

  const eligibilityReasons = getCampaignEligibilityReasons({
    minFollowers,
    requirements,
    socialAccounts,
  });

  return {
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    description: row.description,
    budget: String(row.budget),
    minFollowers,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    applicationWindowOpen: Number(row.window_open) === 1,
    creatorLimit,
    acceptedApplications,
    remainingSlots: Math.max(0, creatorLimit - acceptedApplications),
    brandName: row.brand_name,
    categoryName: row.category_name,
    applicationStatus: row.application_status,
    requirements,
    eligible: eligibilityReasons.length === 0,
    eligibilityReasons,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function mapSocialAccounts(
  rows: SocialAccountRow[],
): CreatorSocialAccountEligibility[] {
  return rows.map((row) => ({
    platform: row.platform,
    followers: Number(row.followers),
    engagementRate:
      row.engagement_rate === null ? null : Number(row.engagement_rate),
  }));
}

async function listRequirementsForCampaigns(
  campaignIds: number[],
): Promise<Map<number, CampaignRequirementRecord[]>> {
  const requirementsByCampaign = new Map<
    number,
    CampaignRequirementRecord[]
  >();

  if (campaignIds.length === 0) {
    return requirementsByCampaign;
  }

  const placeholders = campaignIds.map(() => "?").join(", ");
  const requirementRows = await query<RequirementRow[]>(
    `SELECT campaign_id, requirement_id, platform, required_niche,
            min_engagement_rate
     FROM campaign_requirements
     WHERE campaign_id IN (${placeholders})
     ORDER BY campaign_id ASC, requirement_id ASC`,
    campaignIds,
  );

  for (const row of requirementRows) {
    const requirements = requirementsByCampaign.get(row.campaign_id) ?? [];
    requirements.push(mapRequirement(row));
    requirementsByCampaign.set(row.campaign_id, requirements);
  }

  return requirementsByCampaign;
}

const campaignOrderBy: Record<
  NonNullable<CreatorCampaignFilters["sort"]>,
  string
> = {
  newest: "c.start_date DESC, c.campaign_id DESC",
  budget_desc: "c.budget DESC, c.campaign_id DESC",
  budget_asc: "c.budget ASC, c.campaign_id DESC",
};

export async function listCreatorCampaigns(
  creatorId: number,
  filters: CreatorCampaignFilters,
): Promise<CreatorCampaignPage> {
  const where: string[] = [];
  const whereParams: Array<string | number> = [];

  if (filters.status && filters.status !== "all") {
    where.push("c.status = ?");
    whereParams.push(filters.status);
  }

  const search = filters.q?.trim();

  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    where.push("(c.campaign_name LIKE ? OR c.description LIKE ?)");
    whereParams.push(pattern, pattern);
  }

  if (filters.categoryId !== undefined) {
    where.push("c.category_id = ?");
    whereParams.push(filters.categoryId);
  }

  if (filters.platform) {
    where.push(
      `EXISTS (
         SELECT 1
         FROM campaign_requirements requirement_filter
         WHERE requirement_filter.campaign_id = c.campaign_id
           AND requirement_filter.platform = ?
       )`,
    );
    whereParams.push(filters.platform);
  }

  if (filters.minBudget !== undefined) {
    where.push("c.budget >= ?");
    whereParams.push(filters.minBudget);
  }

  if (filters.maxBudget !== undefined) {
    where.push("c.budget <= ?");
    whereParams.push(filters.maxBudget);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const orderBy = campaignOrderBy[filters.sort ?? "newest"];
  const offset = (filters.page - 1) * filters.pageSize;

  const [campaignRows, countRows, socialAccountRows] = await Promise.all([
    query<CampaignRow[]>(
      `SELECT c.campaign_id, c.campaign_name, c.description, c.budget,
              c.min_followers, c.start_date, c.end_date, c.creator_limit,
              c.status,
              (c.start_date <= CURRENT_DATE()
               AND c.end_date >= CURRENT_DATE()) AS window_open,
              b.brand_name, cc.category_name, a.status AS application_status,
              (SELECT COUNT(*)
               FROM applications accepted
               WHERE accepted.campaign_id = c.campaign_id
                 AND accepted.status = 'Accepted') AS accepted_count
       FROM campaigns c
       INNER JOIN brands b ON b.brand_id = c.brand_id
       LEFT JOIN campaign_categories cc ON cc.category_id = c.category_id
       LEFT JOIN applications a
         ON a.campaign_id = c.campaign_id AND a.creator_id = ?
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [creatorId, ...whereParams, filters.pageSize, offset],
    ),
    query<CampaignCountRow[]>(
      `SELECT COUNT(*) AS total
       FROM campaigns c
       ${whereSql}`,
      whereParams,
    ),
    query<SocialAccountRow[]>(
      `SELECT platform, followers, engagement_rate
       FROM creator_social_accounts
       WHERE creator_id = ?`,
      [creatorId],
    ),
  ]);

  const requirementRowsByCampaign = await listRequirementsForCampaigns(
    campaignRows.map((row) => row.campaign_id),
  );
  const socialAccounts = mapSocialAccounts(socialAccountRows);
  const total = Number(countRows[0]?.total ?? 0);

  return {
    campaigns: campaignRows.map((row) =>
      mapCampaign(
        row,
        requirementRowsByCampaign.get(row.campaign_id) ?? [],
        socialAccounts,
      ),
    ),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

export async function getCreatorCampaignById(
  creatorId: number,
  campaignId: number,
): Promise<CreatorCampaignRecord | null> {
  const campaignRows = await query<CampaignRow[]>(
    `SELECT c.campaign_id, c.campaign_name, c.description, c.budget,
            c.min_followers, c.start_date, c.end_date, c.creator_limit,
            c.status,
            (c.start_date <= CURRENT_DATE()
             AND c.end_date >= CURRENT_DATE()) AS window_open,
            b.brand_name, cc.category_name, a.status AS application_status,
            (SELECT COUNT(*)
             FROM applications accepted
             WHERE accepted.campaign_id = c.campaign_id
               AND accepted.status = 'Accepted') AS accepted_count
     FROM campaigns c
     INNER JOIN brands b ON b.brand_id = c.brand_id
     LEFT JOIN campaign_categories cc ON cc.category_id = c.category_id
     LEFT JOIN applications a
       ON a.campaign_id = c.campaign_id AND a.creator_id = ?
     WHERE c.campaign_id = ?
     LIMIT 1`,
    [creatorId, campaignId],
  );
  const campaignRow = campaignRows[0];

  if (!campaignRow) {
    return null;
  }

  const [requirementRows, socialAccountRows] = await Promise.all([
    query<RequirementRow[]>(
      `SELECT campaign_id, requirement_id, platform, required_niche,
              min_engagement_rate
       FROM campaign_requirements
       WHERE campaign_id = ?
       ORDER BY requirement_id ASC`,
      [campaignId],
    ),
    query<SocialAccountRow[]>(
      `SELECT platform, followers, engagement_rate
       FROM creator_social_accounts
       WHERE creator_id = ?`,
      [creatorId],
    ),
  ]);

  return mapCampaign(
    campaignRow,
    requirementRows.map(mapRequirement),
    mapSocialAccounts(socialAccountRows),
  );
}

export async function getCampaignFilterOptions(): Promise<CampaignFilterOptions> {
  const [categoryRows, platformRows] = await Promise.all([
    query<CampaignCategoryRow[]>(
      `SELECT category_id, category_name
       FROM campaign_categories
       ORDER BY category_name ASC`,
    ),
    query<CampaignPlatformRow[]>(
      `SELECT DISTINCT platform
       FROM campaign_requirements
       WHERE platform IS NOT NULL
       ORDER BY platform ASC`,
    ),
  ]);

  return {
    categories: categoryRows.map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
    })),
    platforms: platformRows.map((row) => row.platform),
  };
}

export type CampaignApplicationFailureCode =
  | "CAMPAIGN_NOT_FOUND"
  | "CAMPAIGN_NOT_OPEN"
  | "APPLICATION_WINDOW_CLOSED"
  | "DUPLICATE_APPLICATION"
  | "CAMPAIGN_FULL"
  | "INELIGIBLE";

export class CampaignApplicationError extends Error {
  constructor(
    readonly code: CampaignApplicationFailureCode,
    message: string,
    readonly reasons: string[] = [],
  ) {
    super(message);
    this.name = "CampaignApplicationError";
  }
}

type LockedCampaignRow = RowDataPacket & {
  campaign_id: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  application_date: string;
  creator_limit: number | string;
  min_followers: number | string;
};

type ExistingApplicationRow = RowDataPacket & {
  application_id: number;
};

type AcceptedCountRow = RowDataPacket & {
  accepted_count: number | string;
};

type MysqlDuplicateError = {
  code?: unknown;
  sqlMessage?: unknown;
};

function isCampaignCreatorDuplicate(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const databaseError = error as MysqlDuplicateError;

  return (
    databaseError.code === "ER_DUP_ENTRY" &&
    typeof databaseError.sqlMessage === "string" &&
    databaseError.sqlMessage.includes("uq_campaign_creator")
  );
}

async function loadApplicationEligibility(
  connection: PoolConnection,
  campaignId: number,
  creatorId: number,
  minFollowers: number,
): Promise<string[]> {
  const [requirementRows] = await connection.execute<RequirementRow[]>(
    `SELECT campaign_id, requirement_id, platform, required_niche,
            min_engagement_rate
     FROM campaign_requirements
     WHERE campaign_id = ?
     ORDER BY requirement_id ASC`,
    [campaignId],
  );
  const [socialAccountRows] = await connection.execute<SocialAccountRow[]>(
    `SELECT platform, followers, engagement_rate
     FROM creator_social_accounts
     WHERE creator_id = ?`,
    [creatorId],
  );

  const requirements = requirementRows.map(mapRequirement);
  const socialAccounts: CreatorSocialAccountEligibility[] =
    socialAccountRows.map((row) => ({
      platform: row.platform,
      followers: Number(row.followers),
      engagementRate:
        row.engagement_rate === null ? null : Number(row.engagement_rate),
    }));

  return getCampaignEligibilityReasons({
    minFollowers,
    requirements,
    socialAccounts,
  });
}

export async function applyCreatorToCampaign(
  creatorId: number,
  campaignId: number,
): Promise<{ applicationId: number; status: ApplicationStatus }> {
  const connection = await pool.getConnection();
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();

    const [campaignRows] = await connection.execute<LockedCampaignRow[]>(
      `SELECT campaign_id, status, start_date, end_date,
              CURRENT_DATE() AS application_date,
              creator_limit, min_followers
       FROM campaigns
       WHERE campaign_id = ?
       FOR UPDATE`,
      [campaignId],
    );
    const campaign = campaignRows[0];

    if (!campaign) {
      throw new CampaignApplicationError(
        "CAMPAIGN_NOT_FOUND",
        "This campaign could not be found.",
      );
    }

    if (
      !campaign.start_date ||
      !campaign.end_date ||
      campaign.start_date > campaign.application_date ||
      campaign.end_date < campaign.application_date
    ) {
      throw new CampaignApplicationError(
        "APPLICATION_WINDOW_CLOSED",
        "This campaign is outside its application date window.",
      );
    }

    if (campaign.status !== "Open") {
      throw new CampaignApplicationError(
        "CAMPAIGN_NOT_OPEN",
        "This campaign is no longer accepting applications.",
      );
    }

    const [existingApplications] =
      await connection.execute<ExistingApplicationRow[]>(
        `SELECT application_id
         FROM applications
         WHERE campaign_id = ? AND creator_id = ?
         LIMIT 1`,
        [campaignId, creatorId],
      );

    if (existingApplications.length > 0) {
      throw new CampaignApplicationError(
        "DUPLICATE_APPLICATION",
        "You have already applied to this campaign.",
      );
    }

    const [acceptedCountRows] = await connection.execute<AcceptedCountRow[]>(
      `SELECT COUNT(*) AS accepted_count
       FROM applications
       WHERE campaign_id = ? AND status = 'Accepted'`,
      [campaignId],
    );
    const acceptedCount = Number(acceptedCountRows[0]?.accepted_count ?? 0);

    if (acceptedCount >= Number(campaign.creator_limit)) {
      throw new CampaignApplicationError(
        "CAMPAIGN_FULL",
        "This campaign has reached its creator limit.",
      );
    }

    const eligibilityReasons = await loadApplicationEligibility(
      connection,
      campaignId,
      creatorId,
      Number(campaign.min_followers),
    );

    if (eligibilityReasons.length > 0) {
      throw new CampaignApplicationError(
        "INELIGIBLE",
        "Your social accounts do not meet this campaign's requirements.",
        eligibilityReasons,
      );
    }

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO applications
         (campaign_id, creator_id, applied_date, status)
       VALUES (?, ?, CURRENT_DATE(), ?)`,
      [campaignId, creatorId, "Pending"],
    );

    await connection.commit();

    return {
      applicationId: insertResult.insertId,
      status: "Pending",
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      connection.destroy();
      connectionDestroyed = true;
      console.error(
        "Campaign application rollback failed; connection discarded:",
        rollbackError instanceof Error ? rollbackError.message : "Unknown error",
      );
    }

    if (isCampaignCreatorDuplicate(error)) {
      throw new CampaignApplicationError(
        "DUPLICATE_APPLICATION",
        "You have already applied to this campaign.",
      );
    }

    throw error;
  } finally {
    if (!connectionDestroyed) {
      connection.release();
    }
  }
}
