import type { RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";
import {
  statusCount,
  type ActivityRecord,
  type StatusCount,
} from "@/lib/repositories/dashboard-types";
import {
  getCreatorProfile,
  listSocialAccounts,
  type CreatorProfileRecord,
  type SocialAccountRecord,
} from "@/lib/repositories/creator-profiles";

type StatusCountRow = RowDataPacket & {
  status: string;
  count: number | string;
};

type TotalRow = RowDataPacket & {
  total: number | string | null;
};

type PaymentSummaryRow = RowDataPacket & {
  status: string;
  count: number | string;
  total: number | string | null;
};

type ActivityRow = RowDataPacket & {
  event_type: string;
  event_date: string;
  title: string;
  detail: string;
  related_id: number;
};

type RatingSummaryRow = RowDataPacket & {
  average_rating: number | string | null;
  review_count: number | string;
};

type PerformanceSummaryRow = RowDataPacket & {
  views: number | string | null;
  likes: number | string | null;
  comments: number | string | null;
  shares: number | string | null;
  clicks: number | string | null;
};

function sumMoney(values: Array<number | string | null | undefined>): string {
  const cents = values.reduce((total, value) => {
    const text = String(value ?? "0");
    const match = text.match(/^(-?)(\d+)(?:\.(\d+))?$/);
    if (!match) {
      throw new Error("Database returned an invalid DECIMAL value.");
    }
    const [, sign, whole, fraction = ""] = match;
    const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
    return total + (sign === "-" ? -amount : amount);
  }, 0n);
  const sign = cents < 0n ? "-" : "";
  const absolute = cents < 0n ? -cents : cents;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export type CreatorDashboardData = {
  profile: CreatorProfileRecord;
  socialAccounts: SocialAccountRecord[];
  totalFollowers: string;
  profileCompleteness: number;
  openCampaigns: number;
  applications: StatusCount;
  collaborations: StatusCount;
  deliverables: StatusCount;
  submissions: StatusCount;
  averageRating: string | null;
  reviewCount: number;
  performance: {
    views: string;
    likes: string;
    comments: string;
    shares: string;
    clicks: string;
  };
  payments: {
    count: StatusCount;
    paidTotal: string;
    pendingTotal: string;
    agreedTotal: string;
  };
  recentActivity: ActivityRecord[];
};

export async function getCreatorDashboardData(
  creatorId: number,
): Promise<CreatorDashboardData | null> {
  const profile = await getCreatorProfile(creatorId);

  if (!profile) {
    return null;
  }

  const [
    socialAccounts,
    followerRows,
    openCampaignRows,
    applicationRows,
    collaborationRows,
    deliverableRows,
    paymentRows,
    agreedRows,
    activityRows,
    submissionRows,
    ratingRows,
    performanceRows,
  ] = await Promise.all([
    listSocialAccounts(creatorId),
    query<TotalRow[]>(
      `SELECT COALESCE(SUM(followers), 0) AS total
       FROM creator_social_accounts
       WHERE creator_id = ?`,
      [creatorId],
    ),
    query<TotalRow[]>(
      `SELECT COUNT(*) AS total
       FROM campaigns
       WHERE status = 'Open'
         AND start_date <= CURRENT_DATE()
         AND end_date >= CURRENT_DATE()`,
    ),
    query<StatusCountRow[]>(
      "SELECT status, COUNT(*) AS count FROM applications WHERE creator_id = ? GROUP BY status",
      [creatorId],
    ),
    query<StatusCountRow[]>(
      `SELECT co.status, COUNT(*) AS count
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.creator_id = ?
       GROUP BY co.status`,
      [creatorId],
    ),
    query<StatusCountRow[]>(
      `SELECT d.status, COUNT(*) AS count
       FROM deliverables d
       INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.creator_id = ?
       GROUP BY d.status`,
      [creatorId],
    ),
    query<PaymentSummaryRow[]>(
      `SELECT p.status, COUNT(*) AS count, COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.creator_id = ?
       GROUP BY p.status`,
      [creatorId],
    ),
    query<TotalRow[]>(
      `SELECT COALESCE(SUM(co.agreed_amount), 0) AS total
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.creator_id = ?`,
      [creatorId],
    ),
    query<ActivityRow[]>(
      `SELECT 'application' COLLATE utf8mb4_0900_ai_ci AS event_type,
              a.applied_date AS event_date,
              CONCAT('Applied to ', ca.campaign_name)
                COLLATE utf8mb4_0900_ai_ci AS title,
              a.status AS detail, a.application_id AS related_id
       FROM applications a
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE a.creator_id = ?
       UNION ALL
       SELECT 'collaboration' COLLATE utf8mb4_0900_ai_ci, co.start_date,
              CONCAT('Collaboration with ', b.brand_name)
                COLLATE utf8mb4_0900_ai_ci,
              co.status, co.collaboration_id
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN brands b ON b.brand_id = ca.brand_id
       WHERE a.creator_id = ?
       UNION ALL
       SELECT 'deliverable' COLLATE utf8mb4_0900_ai_ci, d.due_date,
              CONCAT(d.content_type, ' deliverable due')
                COLLATE utf8mb4_0900_ai_ci,
              d.status, d.deliverable_id
       FROM deliverables d
       INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.creator_id = ?
       UNION ALL
       SELECT 'payment' COLLATE utf8mb4_0900_ai_ci,
              COALESCE(p.payment_date, co.start_date),
              CONCAT('Payment of INR ', CAST(p.amount AS CHAR), ' for ', ca.campaign_name)
                COLLATE utf8mb4_0900_ai_ci,
              p.status, p.payment_id
       FROM payments p
       INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE a.creator_id = ?
       ORDER BY event_date DESC, related_id DESC
       LIMIT 8`,
      [creatorId, creatorId, creatorId, creatorId],
    ),
    query<StatusCountRow[]>(
      `SELECT s.approval_status AS status, COUNT(*) AS count
       FROM content_submissions s
       INNER JOIN deliverables d ON d.deliverable_id = s.deliverable_id
       INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.creator_id = ?
       GROUP BY s.approval_status`,
      [creatorId],
    ),
    query<RatingSummaryRow[]>(
      `SELECT AVG(rv.rating) AS average_rating, COUNT(rv.review_id) AS review_count
       FROM reviews rv
       INNER JOIN collaborations co ON co.collaboration_id = rv.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.creator_id = ?`,
      [creatorId],
    ),
    query<PerformanceSummaryRow[]>(
      `SELECT COALESCE(SUM(pm.views), 0) AS views,
              COALESCE(SUM(pm.likes), 0) AS likes,
              COALESCE(SUM(pm.comments), 0) AS comments,
              COALESCE(SUM(pm.shares), 0) AS shares,
              COALESCE(SUM(pm.clicks), 0) AS clicks
       FROM performance_metrics pm
       INNER JOIN collaborations co ON co.collaboration_id = pm.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.creator_id = ?`,
      [creatorId],
    ),
  ]);

  const paymentCount: Array<{ status: string; count: number | string }> =
    paymentRows.map((row) => ({ status: row.status, count: row.count }));

  const paidTotal = sumMoney(
    paymentRows.filter((row) => row.status === "Paid").map((row) => row.total),
  );
  const pendingTotal = sumMoney(
    paymentRows.filter((row) => row.status === "Pending").map((row) => row.total),
  );
  const rating = ratingRows[0];
  const performance = performanceRows[0];
  const profileFields = [
    profile.firstName,
    profile.lastName,
    profile.phone,
    profile.bio,
    profile.city,
    profile.state,
    profile.profilePictureUrl,
    socialAccounts.length > 0 ? "social-account" : null,
  ];

  return {
    profile,
    socialAccounts,
    totalFollowers: String(followerRows[0]?.total ?? "0"),
    profileCompleteness: Math.round(
      (profileFields.filter((value) => value !== null && value.trim().length > 0)
        .length /
        profileFields.length) *
        100,
    ),
    openCampaigns: Number(openCampaignRows[0]?.total ?? 0),
    applications: statusCount(applicationRows),
    collaborations: statusCount(collaborationRows),
    deliverables: statusCount(deliverableRows),
    submissions: statusCount(submissionRows),
    averageRating:
      rating?.average_rating === null || rating?.average_rating === undefined
        ? null
        : String(rating.average_rating),
    reviewCount: Number(rating?.review_count ?? 0),
    performance: {
      views: String(performance?.views ?? "0"),
      likes: String(performance?.likes ?? "0"),
      comments: String(performance?.comments ?? "0"),
      shares: String(performance?.shares ?? "0"),
      clicks: String(performance?.clicks ?? "0"),
    },
    payments: {
      count: statusCount(paymentCount),
      paidTotal,
      pendingTotal,
      agreedTotal: String(agreedRows[0]?.total ?? "0.00"),
    },
    recentActivity: activityRows.map(mapActivity),
  };
}

type BrandCampaignStatusRow = StatusCountRow;
type BrandStatsRow = RowDataPacket & {
  total_budget: number | string | null;
};

export type BrandDashboardData = {
  profile: {
    brandId: number;
    userId: number;
    username: string;
    email: string;
    brandName: string;
    industry: string | null;
    contactNumber: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  };
  campaigns: StatusCount;
  totalBudget: string;
  applications: StatusCount;
  collaborations: StatusCount;
  deliverables: StatusCount;
  submissions: StatusCount;
  performance: {
    views: string;
    likes: string;
    comments: string;
    shares: string;
    clicks: string;
  };
  topCreators: Array<{
    creatorId: number;
    creatorName: string;
    collaborationCount: number;
    views: string;
  }>;
  payments: {
    count: StatusCount;
    paidTotal: string;
    pendingTotal: string;
  };
  recentActivity: ActivityRecord[];
};

export async function getBrandDashboardData(
  brandId: number,
): Promise<BrandDashboardData | null> {
  const profileRows = await query<
    (RowDataPacket & {
      brand_id: number;
      user_id: number;
      username: string;
      email: string;
      brand_name: string;
      industry: string | null;
      contact_number: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
    })[]
  >(
    `SELECT b.brand_id, b.user_id, u.username, u.email, b.brand_name, b.industry,
            b.contact_number, b.address, b.city, b.state
     FROM brands b
     INNER JOIN users u ON u.user_id = b.user_id
     WHERE b.brand_id = ?
     LIMIT 1`,
    [brandId],
  );

  const profile = profileRows[0];

  if (!profile) {
    return null;
  }

  const [
    campaignRows,
    budgetRows,
    applicationRows,
    collaborationRows,
    deliverableRows,
    submissionRows,
    paymentRows,
    performanceRows,
    topCreatorRows,
    activityRows,
  ] = await Promise.all([
    query<BrandCampaignStatusRow[]>(
      "SELECT status, COUNT(*) AS count FROM campaigns WHERE brand_id = ? GROUP BY status",
      [brandId],
    ),
    query<BrandStatsRow[]>(
      "SELECT COALESCE(SUM(budget), 0) AS total_budget FROM campaigns WHERE brand_id = ?",
      [brandId],
    ),
    query<StatusCountRow[]>(
      `SELECT a.status, COUNT(*) AS count
       FROM applications a
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE ca.brand_id = ?
       GROUP BY a.status`,
      [brandId],
    ),
    query<StatusCountRow[]>(
      `SELECT co.status, COUNT(*) AS count
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE ca.brand_id = ?
       GROUP BY co.status`,
      [brandId],
    ),
    query<StatusCountRow[]>(
      `SELECT d.status, COUNT(*) AS count
       FROM deliverables d
       INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE ca.brand_id = ?
       GROUP BY d.status`,
      [brandId],
    ),
    query<StatusCountRow[]>(
      `SELECT s.approval_status AS status, COUNT(*) AS count
       FROM content_submissions s
       INNER JOIN deliverables d ON d.deliverable_id = s.deliverable_id
       INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE ca.brand_id = ?
       GROUP BY s.approval_status`,
      [brandId],
    ),
    query<PaymentSummaryRow[]>(
      `SELECT p.status, COUNT(*) AS count, COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE ca.brand_id = ?
       GROUP BY p.status`,
      [brandId],
    ),
    query<PerformanceSummaryRow[]>(
      `SELECT COALESCE(SUM(pm.views), 0) AS views,
              COALESCE(SUM(pm.likes), 0) AS likes,
              COALESCE(SUM(pm.comments), 0) AS comments,
              COALESCE(SUM(pm.shares), 0) AS shares,
              COALESCE(SUM(pm.clicks), 0) AS clicks
       FROM performance_metrics pm
       INNER JOIN collaborations co ON co.collaboration_id = pm.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE ca.brand_id = ?`,
      [brandId],
    ),
    query<
      (RowDataPacket & {
        creator_id: number;
        creator_name: string;
        collaboration_count: number | string;
        views: number | string;
      })[]
    >(
      `SELECT cr.creator_id,
              CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
              COUNT(DISTINCT co.collaboration_id) AS collaboration_count,
              COALESCE(SUM(pm.views), 0) AS views
       FROM creators cr
       INNER JOIN applications a ON a.creator_id = cr.creator_id
       INNER JOIN collaborations co ON co.application_id = a.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN performance_metrics pm ON pm.collaboration_id = co.collaboration_id
       WHERE ca.brand_id = ?
       GROUP BY cr.creator_id, cr.first_name, cr.last_name
       ORDER BY views DESC, collaboration_count DESC
       LIMIT 5`,
      [brandId],
    ),
    query<ActivityRow[]>(
      `SELECT 'campaign' COLLATE utf8mb4_0900_ai_ci AS event_type,
              ca.start_date AS event_date,
              CONCAT('Campaign: ', ca.campaign_name)
                COLLATE utf8mb4_0900_ai_ci AS title,
              ca.status AS detail, ca.campaign_id AS related_id
       FROM campaigns ca
       WHERE ca.brand_id = ?
       UNION ALL
       SELECT 'application' COLLATE utf8mb4_0900_ai_ci, a.applied_date,
              CONCAT('Application from ', cr.first_name, ' ', cr.last_name)
                COLLATE utf8mb4_0900_ai_ci,
              a.status, a.application_id
       FROM applications a
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN creators cr ON cr.creator_id = a.creator_id
       WHERE ca.brand_id = ?
       UNION ALL
       SELECT 'collaboration' COLLATE utf8mb4_0900_ai_ci, co.start_date,
              CONCAT('Collaboration with ', cr.first_name, ' ', cr.last_name)
                COLLATE utf8mb4_0900_ai_ci,
              co.status, co.collaboration_id
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN creators cr ON cr.creator_id = a.creator_id
       WHERE ca.brand_id = ?
       UNION ALL
       SELECT 'deliverable' COLLATE utf8mb4_0900_ai_ci, d.due_date,
              CONCAT(d.content_type, ' deliverable for ', ca.campaign_name)
                COLLATE utf8mb4_0900_ai_ci,
              d.status, d.deliverable_id
       FROM deliverables d
       INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE ca.brand_id = ?
       UNION ALL
       SELECT 'payment' COLLATE utf8mb4_0900_ai_ci,
              COALESCE(p.payment_date, co.start_date),
              CONCAT('Payment of INR ', CAST(p.amount AS CHAR), ' for ', ca.campaign_name)
                COLLATE utf8mb4_0900_ai_ci,
              p.status, p.payment_id
       FROM payments p
       INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE ca.brand_id = ?
       ORDER BY event_date DESC, related_id DESC
       LIMIT 8`,
      [brandId, brandId, brandId, brandId, brandId],
    ),
  ]);

  const paymentCount = paymentRows.map((row) => ({
    status: row.status,
    count: row.count,
  }));
  const pendingTotal = paymentRows
    .filter((row) => row.status === "Pending")
    .map((row) => row.total);
  const paidTotal = paymentRows
    .filter((row) => row.status === "Paid")
    .map((row) => row.total);
  const performance = performanceRows[0];

  return {
    profile: {
      brandId: profile.brand_id,
      userId: profile.user_id,
      username: profile.username,
      email: profile.email,
      brandName: profile.brand_name,
      industry: profile.industry,
      contactNumber: profile.contact_number,
      address: profile.address,
      city: profile.city,
      state: profile.state,
    },
    campaigns: statusCount(campaignRows),
    totalBudget: String(budgetRows[0]?.total_budget ?? "0.00"),
    applications: statusCount(applicationRows),
    collaborations: statusCount(collaborationRows),
    deliverables: statusCount(deliverableRows),
    submissions: statusCount(submissionRows),
    performance: {
      views: String(performance?.views ?? "0"),
      likes: String(performance?.likes ?? "0"),
      comments: String(performance?.comments ?? "0"),
      shares: String(performance?.shares ?? "0"),
      clicks: String(performance?.clicks ?? "0"),
    },
    topCreators: topCreatorRows.map((row) => ({
      creatorId: row.creator_id,
      creatorName: row.creator_name.trim(),
      collaborationCount: Number(row.collaboration_count),
      views: String(row.views),
    })),
    payments: {
      count: statusCount(paymentCount),
      paidTotal: sumMoney(paidTotal),
      pendingTotal: sumMoney(pendingTotal),
    },
    recentActivity: activityRows.map(mapActivity),
  };
}

type AdminMetricRow = RowDataPacket & {
  users: number | string;
  creators: number | string;
  brands: number | string;
  campaigns: number | string;
  collaborations: number | string;
  completed_collaborations: number | string;
  payments: number | string;
  applications: number | string;
  submissions: number | string;
  reviews: number | string;
  paid_total: number | string | null;
  paid_count: number | string;
  average_rating: number | string | null;
};

type AdminRecentUserRow = RowDataPacket & {
  user_id: number;
  username: string;
  role: string;
  created_at: string;
};

type AdminRecentCampaignRow = RowDataPacket & {
  campaign_id: number;
  campaign_name: string;
  status: string;
  budget: number | string;
  start_date: string;
  end_date: string;
  brand_name: string;
};

type AdminRecentCollaborationRow = RowDataPacket & {
  collaboration_id: number;
  status: string;
  agreed_amount: number | string;
  start_date: string;
  creator_name: string;
  campaign_name: string;
  brand_name: string;
};

export type AdminDashboardData = {
  counts: {
    users: number;
    creators: number;
    brands: number;
    campaigns: number;
    collaborations: number;
    completedCollaborations: number;
    payments: number;
    paidCount: number;
    applications: number;
    submissions: number;
    reviews: number;
    totalActivity: number;
    averageRating: string | null;
  };
  paidTotal: string;
  roleCounts: StatusCount;
  campaignStatuses: StatusCount;
  applicationStatuses: StatusCount;
  collaborationStatuses: StatusCount;
  paymentStatuses: StatusCount;
  recentUsers: Array<{
    userId: number;
    username: string;
    role: string;
    createdAt: string;
  }>;
  recentCampaigns: Array<{
    campaignId: number;
    campaignName: string;
    status: string;
    budget: string;
    startDate: string;
    endDate: string;
    brandName: string;
  }>;
  recentCollaborations: Array<{
    collaborationId: number;
    status: string;
    agreedAmount: string;
    startDate: string;
    creatorName: string;
    campaignName: string;
    brandName: string;
  }>;
};

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    metricRows,
    roleRows,
    campaignStatusRows,
    applicationStatusRows,
    collaborationStatusRows,
    paymentStatusRows,
    userRows,
    campaignRows,
    collaborationRows,
  ] = await Promise.all([
    query<AdminMetricRow[]>(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM creators) AS creators,
         (SELECT COUNT(*) FROM brands) AS brands,
         (SELECT COUNT(*) FROM campaigns) AS campaigns,
         (SELECT COUNT(*) FROM collaborations) AS collaborations,
         (SELECT COUNT(*) FROM collaborations WHERE status = 'Completed') AS completed_collaborations,
         (SELECT COUNT(*) FROM payments) AS payments,
         (SELECT COUNT(*) FROM payments WHERE status = 'Paid') AS paid_count,
         (SELECT COUNT(*) FROM applications) AS applications,
         (SELECT COUNT(*) FROM content_submissions) AS submissions,
         (SELECT COUNT(*) FROM reviews) AS reviews,
         (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'Paid') AS paid_total,
         (SELECT AVG(rating) FROM reviews) AS average_rating`,
    ),
    query<StatusCountRow[]>(
      "SELECT role AS status, COUNT(*) AS count FROM users GROUP BY role",
    ),
    query<StatusCountRow[]>(
      "SELECT status, COUNT(*) AS count FROM campaigns GROUP BY status",
    ),
    query<StatusCountRow[]>(
      "SELECT status, COUNT(*) AS count FROM applications GROUP BY status",
    ),
    query<StatusCountRow[]>(
      "SELECT status, COUNT(*) AS count FROM collaborations GROUP BY status",
    ),
    query<StatusCountRow[]>(
      "SELECT status, COUNT(*) AS count FROM payments GROUP BY status",
    ),
    query<AdminRecentUserRow[]>(
      `SELECT user_id, username, role, created_at
       FROM users
       ORDER BY created_at DESC, user_id DESC
       LIMIT 6`,
    ),
    query<AdminRecentCampaignRow[]>(
      `SELECT ca.campaign_id, ca.campaign_name, ca.status, ca.budget,
              ca.start_date, ca.end_date, b.brand_name
       FROM campaigns ca
       INNER JOIN brands b ON b.brand_id = ca.brand_id
       ORDER BY ca.start_date DESC, ca.campaign_id DESC
       LIMIT 6`,
    ),
    query<AdminRecentCollaborationRow[]>(
      `SELECT co.collaboration_id, co.status, co.agreed_amount, co.start_date,
              CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
              ca.campaign_name, b.brand_name
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN creators cr ON cr.creator_id = a.creator_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN brands b ON b.brand_id = ca.brand_id
       ORDER BY co.start_date DESC, co.collaboration_id DESC
       LIMIT 6`,
    ),
  ]);

  const metrics = metricRows[0];
  const counts = {
    users: Number(metrics?.users ?? 0),
    creators: Number(metrics?.creators ?? 0),
    brands: Number(metrics?.brands ?? 0),
    campaigns: Number(metrics?.campaigns ?? 0),
    collaborations: Number(metrics?.collaborations ?? 0),
    completedCollaborations: Number(metrics?.completed_collaborations ?? 0),
    payments: Number(metrics?.payments ?? 0),
    paidCount: Number(metrics?.paid_count ?? 0),
    applications: Number(metrics?.applications ?? 0),
    submissions: Number(metrics?.submissions ?? 0),
    reviews: Number(metrics?.reviews ?? 0),
    totalActivity: 0,
    averageRating:
      metrics?.average_rating == null ? null : String(metrics.average_rating),
  };

  counts.totalActivity =
    counts.applications +
    counts.submissions +
    counts.reviews +
    counts.collaborations;

  return {
    counts,
    paidTotal: String(metrics?.paid_total ?? "0.00"),
    roleCounts: statusCount(roleRows),
    campaignStatuses: statusCount(campaignStatusRows),
    applicationStatuses: statusCount(applicationStatusRows),
    collaborationStatuses: statusCount(collaborationStatusRows),
    paymentStatuses: statusCount(paymentStatusRows),
    recentUsers: userRows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      role: row.role,
      createdAt: row.created_at,
    })),
    recentCampaigns: campaignRows.map((row) => ({
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      status: row.status,
      budget: String(row.budget),
      startDate: row.start_date,
      endDate: row.end_date,
      brandName: row.brand_name,
    })),
    recentCollaborations: collaborationRows.map((row) => ({
      collaborationId: row.collaboration_id,
      status: row.status,
      agreedAmount: String(row.agreed_amount),
      startDate: row.start_date,
      creatorName: row.creator_name,
      campaignName: row.campaign_name,
      brandName: row.brand_name,
    })),
  };
}

function mapActivity(row: ActivityRow): ActivityRecord {
  return {
    id: `${row.event_type}-${row.related_id}`,
    type: row.event_type,
    eventDate: row.event_date,
    title: row.title,
    detail: row.detail,
  };
}
