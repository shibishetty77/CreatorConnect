import type { RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";

export type AdminUserRow = {
  userId: number;
  username: string;
  role: string;
  createdAt: string;
};

export type AdminCreatorRow = {
  creatorId: number;
  username: string;
  name: string;
  city: string | null;
  state: string | null;
  socialAccounts: number;
  followers: string;
  applications: number;
  collaborations: number;
};

export type AdminBrandRow = {
  brandId: number;
  brandName: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  campaigns: number;
  collaborations: number;
};

export type AdminCampaignRow = {
  campaignId: number;
  campaignName: string;
  brandName: string;
  categoryName: string | null;
  status: string;
  budget: string;
  startDate: string;
  endDate: string;
  applications: number;
  collaborations: number;
};

export type AdminCollaborationRow = {
  collaborationId: number;
  creatorName: string;
  campaignName: string;
  brandName: string;
  status: string;
  agreedAmount: string;
  startDate: string;
  endDate: string;
};

export type AdminReviewRow = {
  reviewId: number;
  rating: number;
  feedback: string | null;
  reviewDate: string | null;
  creatorName: string;
  campaignName: string;
  brandName: string;
  collaborationId: number;
};

export type AdminUserReport = {
  userId: number;
  username: string;
  role: string;
  createdAt: string;
  profileName: string | null;
  industry: string | null;
  location: string | null;
  socialAccounts: number;
  followers: string;
  campaigns: number;
  applications: number;
  collaborations: number;
  paidTotal: string;
};

export type AdminCollaborationReport = {
  collaborationId: number;
  creatorName: string;
  campaignName: string;
  brandName: string;
  status: string;
  agreedAmount: string;
  startDate: string;
  endDate: string;
  contract: { signedDate: string | null; expiryDate: string | null } | null;
  deliverables: Array<{ status: string; count: number }>;
  payments: Array<{ status: string; count: number; total: string }>;
  performance: {
    views: string;
    likes: string;
    comments: string;
    shares: string;
    clicks: string;
  } | null;
  review: { rating: number; feedback: string | null; reviewDate: string | null } | null;
};

type UserDbRow = RowDataPacket & {
  user_id: number;
  username: string;
  role: string;
  created_at: string;
};

type CreatorDbRow = RowDataPacket & {
  creator_id: number;
  username: string;
  creator_name: string;
  city: string | null;
  state: string | null;
  social_accounts: number | string;
  followers: string | number;
  applications: number | string;
  collaborations: number | string;
};

type BrandDbRow = RowDataPacket & {
  brand_id: number;
  brand_name: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  campaigns: number | string;
  collaborations: number | string;
};

type CampaignDbRow = RowDataPacket & {
  campaign_id: number;
  campaign_name: string;
  brand_name: string;
  category_name: string | null;
  status: string;
  budget: string | number;
  start_date: string;
  end_date: string;
  applications: number | string;
  collaborations: number | string;
};

type CollaborationDbRow = RowDataPacket & {
  collaboration_id: number;
  creator_name: string;
  campaign_name: string;
  brand_name: string;
  status: string;
  agreed_amount: string | number;
  start_date: string;
  end_date: string;
};

type ReviewDbRow = RowDataPacket & {
  review_id: number;
  rating: number;
  feedback: string | null;
  review_date: string | null;
  creator_name: string;
  campaign_name: string;
  brand_name: string;
  collaboration_id: number;
};

type UserDetailDbRow = RowDataPacket & {
  user_id: number;
  username: string;
  role: string;
  created_at: string;
  profile_name: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  social_accounts: number | string;
  followers: number | string;
  campaigns: number | string;
  applications: number | string;
  collaborations: number | string;
  paid_total: number | string;
};

function count(value: number | string): number {
  return Number(value);
}

function searchValue(value: string | undefined): string {
  return (value ?? "").trim().slice(0, 100);
}

export async function listAdminUsers(input: {
  search?: string;
  role?: string;
} = {}): Promise<AdminUserRow[]> {
  const search = searchValue(input.search);
  const role = ["Creator", "Brand", "Admin"].includes(input.role ?? "")
    ? input.role!
    : "";
  const rows = await query<UserDbRow[]>(
    `SELECT user_id, username, role, created_at
     FROM users
     WHERE (? = '' OR username LIKE CONCAT('%', ?, '%'))
       AND (? = '' OR role = ?)
     ORDER BY created_at DESC, user_id DESC
     LIMIT 100`,
    [search, search, role, role],
  );
  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
  }));
}

export async function listAdminCreators(searchInput?: string): Promise<AdminCreatorRow[]> {
  const search = searchValue(searchInput);
  const rows = await query<CreatorDbRow[]>(
    `SELECT cr.creator_id, u.username,
            CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
            cr.city, cr.state,
            (SELECT COUNT(*) FROM creator_social_accounts sa
             WHERE sa.creator_id = cr.creator_id) AS social_accounts,
            (SELECT COALESCE(SUM(sa.followers), 0) FROM creator_social_accounts sa
             WHERE sa.creator_id = cr.creator_id) AS followers,
            (SELECT COUNT(*) FROM applications a
             WHERE a.creator_id = cr.creator_id) AS applications,
            (SELECT COUNT(*) FROM collaborations co
             INNER JOIN applications a ON a.application_id = co.application_id
             WHERE a.creator_id = cr.creator_id) AS collaborations
     FROM creators cr
     INNER JOIN users u ON u.user_id = cr.user_id
     WHERE (? = '' OR cr.first_name LIKE CONCAT('%', ?, '%')
             OR cr.last_name LIKE CONCAT('%', ?, '%')
             OR u.username LIKE CONCAT('%', ?, '%'))
     ORDER BY cr.creator_id DESC
     LIMIT 100`,
    [search, search, search, search],
  );
  return rows.map((row) => ({
    creatorId: row.creator_id,
    username: row.username,
    name: row.creator_name.trim(),
    city: row.city,
    state: row.state,
    socialAccounts: count(row.social_accounts),
    followers: String(row.followers),
    applications: count(row.applications),
    collaborations: count(row.collaborations),
  }));
}

export async function listAdminBrands(searchInput?: string): Promise<AdminBrandRow[]> {
  const search = searchValue(searchInput);
  const rows = await query<BrandDbRow[]>(
    `SELECT b.brand_id, b.brand_name, b.industry, b.city, b.state,
            (SELECT COUNT(*) FROM campaigns c WHERE c.brand_id = b.brand_id) AS campaigns,
            (SELECT COUNT(*)
             FROM collaborations co
             INNER JOIN applications a ON a.application_id = co.application_id
             INNER JOIN campaigns c ON c.campaign_id = a.campaign_id
             WHERE c.brand_id = b.brand_id) AS collaborations
     FROM brands b
     WHERE (? = '' OR b.brand_name LIKE CONCAT('%', ?, '%')
             OR b.industry LIKE CONCAT('%', ?, '%'))
     ORDER BY b.brand_id DESC
     LIMIT 100`,
    [search, search, search],
  );
  return rows.map((row) => ({
    brandId: row.brand_id,
    brandName: row.brand_name,
    industry: row.industry,
    city: row.city,
    state: row.state,
    campaigns: count(row.campaigns),
    collaborations: count(row.collaborations),
  }));
}

export async function listAdminCampaigns(input: {
  search?: string;
  status?: string;
} = {}): Promise<AdminCampaignRow[]> {
  const search = searchValue(input.search);
  const status = ["Open", "Ongoing", "Completed"].includes(input.status ?? "")
    ? input.status!
    : "";
  const rows = await query<CampaignDbRow[]>(
    `SELECT c.campaign_id, c.campaign_name, b.brand_name, cc.category_name,
            c.status, c.budget, c.start_date, c.end_date,
            (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.campaign_id) AS applications,
            (SELECT COUNT(*)
             FROM collaborations co
             INNER JOIN applications a ON a.application_id = co.application_id
             WHERE a.campaign_id = c.campaign_id) AS collaborations
     FROM campaigns c
     INNER JOIN brands b ON b.brand_id = c.brand_id
     LEFT JOIN campaign_categories cc ON cc.category_id = c.category_id
     WHERE (? = '' OR c.campaign_name LIKE CONCAT('%', ?, '%')
             OR b.brand_name LIKE CONCAT('%', ?, '%'))
       AND (? = '' OR c.status = ?)
     ORDER BY c.campaign_id DESC
     LIMIT 100`,
    [search, search, search, status, status],
  );
  return rows.map((row) => ({
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    brandName: row.brand_name,
    categoryName: row.category_name,
    status: row.status,
    budget: String(row.budget),
    startDate: row.start_date,
    endDate: row.end_date,
    applications: count(row.applications),
    collaborations: count(row.collaborations),
  }));
}

export async function listAdminCollaborations(statusInput?: string): Promise<AdminCollaborationRow[]> {
  const status = ["Active", "Completed"].includes(statusInput ?? "")
    ? statusInput!
    : "";
  const rows = await query<CollaborationDbRow[]>(
    `SELECT co.collaboration_id,
            CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
            ca.campaign_name, b.brand_name, co.status, co.agreed_amount,
            co.start_date, co.end_date
     FROM collaborations co
     INNER JOIN applications a ON a.application_id = co.application_id
     INNER JOIN creators cr ON cr.creator_id = a.creator_id
     INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
     INNER JOIN brands b ON b.brand_id = ca.brand_id
     WHERE (? = '' OR co.status = ?)
     ORDER BY co.start_date DESC, co.collaboration_id DESC
     LIMIT 100`,
    [status, status],
  );
  return rows.map((row) => ({
    collaborationId: row.collaboration_id,
    creatorName: row.creator_name.trim(),
    campaignName: row.campaign_name,
    brandName: row.brand_name,
    status: row.status,
    agreedAmount: String(row.agreed_amount),
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}

export async function listAdminReviews(): Promise<AdminReviewRow[]> {
  const rows = await query<ReviewDbRow[]>(
    `SELECT rv.review_id, rv.rating, rv.feedback, rv.review_date,
            CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
            ca.campaign_name, b.brand_name, co.collaboration_id
     FROM reviews rv
     INNER JOIN collaborations co ON co.collaboration_id = rv.collaboration_id
     INNER JOIN applications a ON a.application_id = co.application_id
     INNER JOIN creators cr ON cr.creator_id = a.creator_id
     INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
     INNER JOIN brands b ON b.brand_id = ca.brand_id
     ORDER BY rv.review_date DESC, rv.review_id DESC
     LIMIT 100`,
  );
  return rows.map((row) => ({
    reviewId: row.review_id,
    rating: row.rating,
    feedback: row.feedback,
    reviewDate: row.review_date,
    creatorName: row.creator_name.trim(),
    campaignName: row.campaign_name,
    brandName: row.brand_name,
    collaborationId: row.collaboration_id,
  }));
}

export async function getAdminUserReport(
  userId: number,
): Promise<AdminUserReport | null> {
  const rows = await query<UserDetailDbRow[]>(
    `SELECT u.user_id, u.username, u.role, u.created_at,
            COALESCE(CONCAT(cr.first_name, ' ', cr.last_name), b.brand_name) AS profile_name,
            b.industry, COALESCE(cr.city, b.city) AS city,
            COALESCE(cr.state, b.state) AS state,
            (SELECT COUNT(*) FROM creator_social_accounts sa
             WHERE sa.creator_id = cr.creator_id) AS social_accounts,
            (SELECT COALESCE(SUM(sa.followers), 0) FROM creator_social_accounts sa
             WHERE sa.creator_id = cr.creator_id) AS followers,
            (SELECT COUNT(*) FROM campaigns ca
             WHERE ca.brand_id = b.brand_id) AS campaigns,
            (SELECT COUNT(*) FROM applications a
             WHERE a.creator_id = cr.creator_id
                OR a.campaign_id IN (
                  SELECT ca.campaign_id FROM campaigns ca WHERE ca.brand_id = b.brand_id
                )) AS applications,
            (SELECT COUNT(*)
             FROM collaborations co
             INNER JOIN applications a ON a.application_id = co.application_id
             INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
             WHERE a.creator_id = cr.creator_id OR ca.brand_id = b.brand_id) AS collaborations,
            (SELECT COALESCE(SUM(p.amount), 0)
             FROM payments p
             INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
             INNER JOIN applications a ON a.application_id = co.application_id
             INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
             WHERE p.status = 'Paid'
               AND (a.creator_id = cr.creator_id OR ca.brand_id = b.brand_id)) AS paid_total
     FROM users u
     LEFT JOIN creators cr ON cr.user_id = u.user_id
     LEFT JOIN brands b ON b.user_id = u.user_id
     WHERE u.user_id = ?
     LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    userId: row.user_id,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
    profileName: row.profile_name?.trim() || null,
    industry: row.industry,
    location: [row.city, row.state].filter(Boolean).join(", ") || null,
    socialAccounts: count(row.social_accounts),
    followers: String(row.followers),
    campaigns: count(row.campaigns),
    applications: count(row.applications),
    collaborations: count(row.collaborations),
    paidTotal: String(row.paid_total),
  };
}

type CollaborationDetailDbRow = RowDataPacket & {
  collaboration_id: number;
  creator_name: string;
  campaign_name: string;
  brand_name: string;
  status: string;
  agreed_amount: number | string;
  start_date: string;
  end_date: string;
  signed_date: string | null;
  expiry_date: string | null;
};

type PaymentStatusDbRow = RowDataPacket & {
  status: string;
  count: number | string;
  total: number | string;
};

type ReviewDetailDbRow = RowDataPacket & {
  rating: number;
  feedback: string | null;
  review_date: string | null;
};

export async function getAdminCollaborationReport(
  collaborationId: number,
): Promise<AdminCollaborationReport | null> {
  const [
    collaborationRows,
    deliverableRows,
    paymentRows,
    performanceRows,
    reviewRows,
  ] = await Promise.all([
    query<CollaborationDetailDbRow[]>(
      `SELECT co.collaboration_id,
              CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
              ca.campaign_name, b.brand_name, co.status, co.agreed_amount,
              co.start_date, co.end_date, ct.signed_date, ct.expiry_date
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN creators cr ON cr.creator_id = a.creator_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN brands b ON b.brand_id = ca.brand_id
       LEFT JOIN contracts ct ON ct.collaboration_id = co.collaboration_id
       WHERE co.collaboration_id = ?
       LIMIT 1`,
      [collaborationId],
    ),
    query<(RowDataPacket & { status: string; count: number | string })[]>(
      `SELECT status, COUNT(*) AS count
       FROM deliverables WHERE collaboration_id = ? GROUP BY status`,
      [collaborationId],
    ),
    query<PaymentStatusDbRow[]>(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
       FROM payments WHERE collaboration_id = ? GROUP BY status`,
      [collaborationId],
    ),
    query<
      (RowDataPacket & {
        views: number | string | null;
        likes: number | string | null;
        comments: number | string | null;
        shares: number | string | null;
        clicks: number | string | null;
      })[]
    >(
      `SELECT views, likes, comments, shares, clicks
       FROM performance_metrics
       WHERE collaboration_id = ?
       LIMIT 1`,
      [collaborationId],
    ),
    query<ReviewDetailDbRow[]>(
      `SELECT rating, feedback, review_date
       FROM reviews
       WHERE collaboration_id = ?
       LIMIT 1`,
      [collaborationId],
    ),
  ]);
  const row = collaborationRows[0];
  if (!row) return null;

  const metric = performanceRows[0];
  const review = reviewRows[0];
  return {
    collaborationId: row.collaboration_id,
    creatorName: row.creator_name.trim(),
    campaignName: row.campaign_name,
    brandName: row.brand_name,
    status: row.status,
    agreedAmount: String(row.agreed_amount),
    startDate: row.start_date,
    endDate: row.end_date,
    contract:
      row.signed_date === null && row.expiry_date === null
        ? null
        : { signedDate: row.signed_date, expiryDate: row.expiry_date },
    deliverables: deliverableRows.map((entry) => ({
      status: entry.status,
      count: count(entry.count),
    })),
    payments: paymentRows.map((entry) => ({
      status: entry.status,
      count: count(entry.count),
      total: String(entry.total),
    })),
    performance: metric
      ? {
          views: String(metric.views ?? "0"),
          likes: String(metric.likes ?? "0"),
          comments: String(metric.comments ?? "0"),
          shares: String(metric.shares ?? "0"),
          clicks: String(metric.clicks ?? "0"),
        }
      : null,
    review: review
      ? {
          rating: review.rating,
          feedback: review.feedback,
          reviewDate: review.review_date,
        }
      : null,
  };
}
