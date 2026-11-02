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

export type CreatorDashboardData = {
  profile: CreatorProfileRecord;
  socialAccounts: SocialAccountRecord[];
  openCampaigns: number;
  applications: StatusCount;
  collaborations: StatusCount;
  deliverables: StatusCount;
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
    openCampaignRows,
    applicationRows,
    collaborationRows,
    deliverableRows,
    paymentRows,
    agreedRows,
    activityRows,
  ] = await Promise.all([
    listSocialAccounts(creatorId),
    query<TotalRow[]>(
      "SELECT COUNT(*) AS total FROM campaigns WHERE status = 'Open'",
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
  ]);

  const paymentCount: Array<{ status: string; count: number | string }> =
    paymentRows.map((row) => ({ status: row.status, count: row.count }));

  const paidTotal = paymentRows
    .filter((row) => row.status === "Paid")
    .reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const pendingTotal = paymentRows
    .filter((row) => row.status === "Pending")
    .reduce((sum, row) => sum + Number(row.total ?? 0), 0);

  return {
    profile,
    socialAccounts,
    openCampaigns: Number(openCampaignRows[0]?.total ?? 0),
    applications: statusCount(applicationRows),
    collaborations: statusCount(collaborationRows),
    deliverables: statusCount(deliverableRows),
    payments: {
      count: statusCount(paymentCount),
      paidTotal: paidTotal.toFixed(2),
      pendingTotal: pendingTotal.toFixed(2),
      agreedTotal: Number(agreedRows[0]?.total ?? 0).toFixed(2),
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
    paymentRows,
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
  const paidTotal = paymentRows
    .filter((row) => row.status === "Paid")
    .reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const pendingTotal = paymentRows
    .filter((row) => row.status === "Pending")
    .reduce((sum, row) => sum + Number(row.total ?? 0), 0);

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
    totalBudget: Number(budgetRows[0]?.total_budget ?? 0).toFixed(2),
    applications: statusCount(applicationRows),
    collaborations: statusCount(collaborationRows),
    payments: {
      count: statusCount(paymentCount),
      paidTotal: paidTotal.toFixed(2),
      pendingTotal: pendingTotal.toFixed(2),
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
};

type AdminRecentUserRow = RowDataPacket & {
  user_id: number;
  username: string;
  email: string;
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
  };
  paidTotal: string;
  roleCounts: StatusCount;
  campaignStatuses: StatusCount;
  recentUsers: Array<{
    userId: number;
    username: string;
    email: string;
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
         (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'Paid') AS paid_total`,
    ),
    query<StatusCountRow[]>(
      "SELECT role AS status, COUNT(*) AS count FROM users GROUP BY role",
    ),
    query<StatusCountRow[]>(
      "SELECT status, COUNT(*) AS count FROM campaigns GROUP BY status",
    ),
    query<AdminRecentUserRow[]>(
      `SELECT user_id, username, email, role, created_at
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
  };

  counts.totalActivity =
    counts.applications +
    counts.submissions +
    counts.reviews +
    counts.collaborations;

  return {
    counts,
    paidTotal: Number(metrics?.paid_total ?? 0).toFixed(2),
    roleCounts: statusCount(roleRows),
    campaignStatuses: statusCount(campaignStatusRows),
    recentUsers: userRows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
    })),
    recentCampaigns: campaignRows.map((row) => ({
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      status: row.status,
      budget: Number(row.budget).toFixed(2),
      startDate: row.start_date,
      endDate: row.end_date,
      brandName: row.brand_name,
    })),
    recentCollaborations: collaborationRows.map((row) => ({
      collaborationId: row.collaboration_id,
      status: row.status,
      agreedAmount: Number(row.agreed_amount).toFixed(2),
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
