import type { RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";

type CountRow = RowDataPacket & {
  status: string;
  count: number | string;
};

type SummaryRow = RowDataPacket & {
  users: number | string;
  creators: number | string;
  brands: number | string;
  campaigns: number | string;
  applications: number | string;
  collaborations: number | string;
  payments: number | string;
  reviews: number | string;
  submissions: number | string;
  paid_total: number | string | null;
  pending_total: number | string | null;
  average_rating: number | string | null;
  review_count: number | string;
};

type CategoryRow = RowDataPacket & {
  category_name: string;
  campaign_count: number | string;
  total_budget: number | string;
};

type PlatformRow = RowDataPacket & {
  platform: string;
  requirement_count: number | string;
  campaign_count: number | string;
};

type MonthlyRow = RowDataPacket & {
  month: string;
  record_count: number | string;
  total: number | string;
};

type CreatorRow = RowDataPacket & {
  creator_id: number;
  creator_name: string;
  collaboration_count: number | string;
  completed_count: number | string;
  views: number | string;
  average_rating: number | string | null;
  review_count: number | string;
};

type BrandRow = RowDataPacket & {
  brand_id: number;
  brand_name: string;
  campaign_count: number | string;
  collaboration_count: number | string;
  paid_total: number | string;
};

type CampaignRow = RowDataPacket & {
  campaign_id: number;
  campaign_name: string;
  brand_name: string;
  category_name: string | null;
  status: string;
  budget: number | string;
  application_count: number | string;
  collaboration_count: number | string;
};

export type AdminReportOverview = {
  totals: {
    users: number;
    creators: number;
    brands: number;
    campaigns: number;
    applications: number;
    collaborations: number;
    payments: number;
    reviews: number;
    submissions: number;
    reviewCount: number;
    averageRating: string | null;
    paidTotal: string;
    pendingTotal: string;
    views: string;
    likes: string;
    comments: string;
    shares: string;
    clicks: string;
  };
  statuses: {
    users: Array<{ status: string; count: number }>;
    campaigns: Array<{ status: string; count: number }>;
    applications: Array<{ status: string; count: number }>;
    collaborations: Array<{ status: string; count: number }>;
    payments: Array<{ status: string; count: number }>;
    deliverables: Array<{ status: string; count: number }>;
    submissions: Array<{ status: string; count: number }>;
  };
  categories: Array<{
    categoryName: string;
    campaignCount: number;
    totalBudget: string;
  }>;
  platforms: Array<{
    platform: string;
    requirementCount: number;
    campaignCount: number;
  }>;
  monthlyPayments: Array<{ month: string; count: number; total: string }>;
  monthlyApplications: Array<{ month: string; count: number }>;
  topCreators: Array<{
    creatorId: number;
    creatorName: string;
    collaborationCount: number;
    completedCount: number;
    views: string;
    averageRating: string | null;
    reviewCount: number;
  }>;
  topBrands: Array<{
    brandId: number;
    brandName: string;
    campaignCount: number;
    collaborationCount: number;
    paidTotal: string;
  }>;
  campaigns: Array<{
    campaignId: number;
    campaignName: string;
    brandName: string;
    categoryName: string | null;
    status: string;
    budget: string;
    applicationCount: number;
    collaborationCount: number;
  }>;
};

export type AdminCampaignReport = {
  campaignId: number;
  campaignName: string;
  description: string | null;
  brandName: string;
  categoryName: string | null;
  status: string;
  budget: string;
  minFollowers: string;
  creatorLimit: number;
  startDate: string;
  endDate: string;
  applications: Array<{ status: string; count: number }>;
  collaborations: Array<{ status: string; count: number }>;
  payments: {
    count: number;
    paidTotal: string;
    pendingTotal: string;
  };
  performance: {
    views: string;
    likes: string;
    comments: string;
    shares: string;
    clicks: string;
  };
  averageRating: string | null;
  reviewCount: number;
};

function countRows(rows: CountRow[]) {
  return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
}

function decimal(value: number | string | null | undefined): string {
  return value == null ? "0.00" : String(value);
}

function integer(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

export async function getAdminReportOverview(): Promise<AdminReportOverview> {
  const [
    summaryRows,
    userStatuses,
    campaignStatuses,
    applicationStatuses,
    collaborationStatuses,
    paymentStatuses,
    deliverableStatuses,
    submissionStatuses,
    categoryRows,
    platformRows,
    monthlyPaymentRows,
    monthlyApplicationRows,
    creatorRows,
    brandRows,
    campaignRows,
  ] = await Promise.all([
    query<SummaryRow[]>(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM creators) AS creators,
         (SELECT COUNT(*) FROM brands) AS brands,
         (SELECT COUNT(*) FROM campaigns) AS campaigns,
         (SELECT COUNT(*) FROM applications) AS applications,
         (SELECT COUNT(*) FROM collaborations) AS collaborations,
         (SELECT COUNT(*) FROM payments) AS payments,
         (SELECT COUNT(*) FROM reviews) AS reviews,
         (SELECT COUNT(*) FROM content_submissions) AS submissions,
         (SELECT COUNT(*) FROM reviews) AS review_count,
         (SELECT AVG(rating) FROM reviews) AS average_rating,
         (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'Paid') AS paid_total,
         (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'Pending') AS pending_total,
         (SELECT COALESCE(SUM(views), 0) FROM performance_metrics) AS views,
         (SELECT COALESCE(SUM(likes), 0) FROM performance_metrics) AS likes,
         (SELECT COALESCE(SUM(comments), 0) FROM performance_metrics) AS comments,
         (SELECT COALESCE(SUM(shares), 0) FROM performance_metrics) AS shares,
         (SELECT COALESCE(SUM(clicks), 0) FROM performance_metrics) AS clicks`,
    ),
    query<CountRow[]>("SELECT role AS status, COUNT(*) AS count FROM users GROUP BY role"),
    query<CountRow[]>("SELECT status, COUNT(*) AS count FROM campaigns GROUP BY status"),
    query<CountRow[]>("SELECT status, COUNT(*) AS count FROM applications GROUP BY status"),
    query<CountRow[]>("SELECT status, COUNT(*) AS count FROM collaborations GROUP BY status"),
    query<CountRow[]>("SELECT status, COUNT(*) AS count FROM payments GROUP BY status"),
    query<CountRow[]>("SELECT status, COUNT(*) AS count FROM deliverables GROUP BY status"),
    query<CountRow[]>(
      "SELECT approval_status AS status, COUNT(*) AS count FROM content_submissions GROUP BY approval_status",
    ),
    query<CategoryRow[]>(
      `SELECT cc.category_name, COUNT(c.campaign_id) AS campaign_count,
              COALESCE(SUM(c.budget), 0) AS total_budget
       FROM campaign_categories cc
       LEFT JOIN campaigns c ON c.category_id = cc.category_id
       GROUP BY cc.category_id, cc.category_name
       ORDER BY campaign_count DESC, cc.category_name ASC
       LIMIT 8`,
    ),
    query<PlatformRow[]>(
      `SELECT platform, COUNT(*) AS requirement_count,
              COUNT(DISTINCT campaign_id) AS campaign_count
       FROM campaign_requirements
       WHERE platform IS NOT NULL AND platform <> ''
       GROUP BY platform
       ORDER BY campaign_count DESC, platform ASC
       LIMIT 8`,
    ),
    query<MonthlyRow[]>(
      `SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month,
              COUNT(*) AS record_count,
              COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount ELSE 0 END), 0) AS total
       FROM payments
       WHERE payment_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
         AND payment_date IS NOT NULL
       GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
       ORDER BY month ASC`,
    ),
    query<(RowDataPacket & { month: string; record_count: number | string })[]>(
      `SELECT DATE_FORMAT(applied_date, '%Y-%m') AS month,
              COUNT(*) AS record_count
       FROM applications
       WHERE applied_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(applied_date, '%Y-%m')
       ORDER BY month ASC`,
    ),
    query<CreatorRow[]>(
      `SELECT cr.creator_id,
              CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
              COUNT(DISTINCT co.collaboration_id) AS collaboration_count,
              COUNT(DISTINCT CASE WHEN co.status = 'Completed'
                                  THEN co.collaboration_id END) AS completed_count,
              COALESCE(SUM(pm.views), 0) AS views,
              AVG(rv.rating) AS average_rating,
              COUNT(DISTINCT rv.review_id) AS review_count
       FROM creators cr
       INNER JOIN applications a ON a.creator_id = cr.creator_id
       INNER JOIN collaborations co ON co.application_id = a.application_id
       LEFT JOIN performance_metrics pm ON pm.collaboration_id = co.collaboration_id
       LEFT JOIN reviews rv ON rv.collaboration_id = co.collaboration_id
       GROUP BY cr.creator_id, cr.first_name, cr.last_name
       ORDER BY completed_count DESC, collaboration_count DESC, views DESC
       LIMIT 8`,
    ),
    query<BrandRow[]>(
      `SELECT b.brand_id, b.brand_name,
              COUNT(DISTINCT ca.campaign_id) AS campaign_count,
              COUNT(DISTINCT co.collaboration_id) AS collaboration_count,
              COALESCE(SUM(CASE WHEN p.status = 'Paid' THEN p.amount ELSE 0 END), 0) AS paid_total
       FROM brands b
       LEFT JOIN campaigns ca ON ca.brand_id = b.brand_id
       LEFT JOIN applications a ON a.campaign_id = ca.campaign_id
       LEFT JOIN collaborations co ON co.application_id = a.application_id
       LEFT JOIN payments p ON p.collaboration_id = co.collaboration_id
       GROUP BY b.brand_id, b.brand_name
       ORDER BY campaign_count DESC, collaboration_count DESC, b.brand_name ASC
       LIMIT 8`,
    ),
    query<CampaignRow[]>(
      `SELECT c.campaign_id, c.campaign_name, b.brand_name, cc.category_name,
              c.status, c.budget,
              (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.campaign_id) AS application_count,
              (SELECT COUNT(*)
               FROM collaborations co
               INNER JOIN applications a ON a.application_id = co.application_id
               WHERE a.campaign_id = c.campaign_id) AS collaboration_count
       FROM campaigns c
       INNER JOIN brands b ON b.brand_id = c.brand_id
       LEFT JOIN campaign_categories cc ON cc.category_id = c.category_id
       ORDER BY c.campaign_id DESC
       LIMIT 12`,
    ),
  ]);

  const summary = summaryRows[0];
  const moneyByMonth = monthlyPaymentRows.map((row) => ({
    month: row.month,
    count: integer(row.record_count),
    total: decimal(row.total),
  }));

  return {
    totals: {
      users: integer(summary?.users),
      creators: integer(summary?.creators),
      brands: integer(summary?.brands),
      campaigns: integer(summary?.campaigns),
      applications: integer(summary?.applications),
      collaborations: integer(summary?.collaborations),
      payments: integer(summary?.payments),
      reviews: integer(summary?.reviews),
      submissions: integer(summary?.submissions),
      reviewCount: integer(summary?.review_count),
      averageRating:
        summary?.average_rating == null ? null : String(summary.average_rating),
      paidTotal: decimal(summary?.paid_total),
      pendingTotal: decimal(summary?.pending_total),
      views: String(summary?.views ?? "0"),
      likes: String(summary?.likes ?? "0"),
      comments: String(summary?.comments ?? "0"),
      shares: String(summary?.shares ?? "0"),
      clicks: String(summary?.clicks ?? "0"),
    },
    statuses: {
      users: countRows(userStatuses),
      campaigns: countRows(campaignStatuses),
      applications: countRows(applicationStatuses),
      collaborations: countRows(collaborationStatuses),
      payments: countRows(paymentStatuses),
      deliverables: countRows(deliverableStatuses),
      submissions: countRows(submissionStatuses),
    },
    categories: categoryRows.map((row) => ({
      categoryName: row.category_name,
      campaignCount: integer(row.campaign_count),
      totalBudget: decimal(row.total_budget),
    })),
    platforms: platformRows.map((row) => ({
      platform: row.platform,
      requirementCount: integer(row.requirement_count),
      campaignCount: integer(row.campaign_count),
    })),
    monthlyPayments: moneyByMonth,
    monthlyApplications: monthlyApplicationRows.map((row) => ({
      month: row.month,
      count: integer(row.record_count),
    })),
    topCreators: creatorRows.map((row) => ({
      creatorId: row.creator_id,
      creatorName: row.creator_name.trim(),
      collaborationCount: integer(row.collaboration_count),
      completedCount: integer(row.completed_count),
      views: String(row.views ?? "0"),
      averageRating:
        row.average_rating === null ? null : String(row.average_rating),
      reviewCount: integer(row.review_count),
    })),
    topBrands: brandRows.map((row) => ({
      brandId: row.brand_id,
      brandName: row.brand_name,
      campaignCount: integer(row.campaign_count),
      collaborationCount: integer(row.collaboration_count),
      paidTotal: decimal(row.paid_total),
    })),
    campaigns: campaignRows.map((row) => ({
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      brandName: row.brand_name,
      categoryName: row.category_name,
      status: row.status,
      budget: decimal(row.budget),
      applicationCount: integer(row.application_count),
      collaborationCount: integer(row.collaboration_count),
    })),
  };
}

type CampaignDetailRow = RowDataPacket & {
  campaign_id: number;
  campaign_name: string;
  description: string | null;
  brand_name: string;
  category_name: string | null;
  status: string;
  budget: number | string;
  min_followers: number | string;
  creator_limit: number | string;
  start_date: string;
  end_date: string;
};

type PaymentTotalsRow = RowDataPacket & {
  count: number | string;
  paid_total: number | string | null;
  pending_total: number | string | null;
};

type PerformanceTotalsRow = RowDataPacket & {
  views: number | string | null;
  likes: number | string | null;
  comments: number | string | null;
  shares: number | string | null;
  clicks: number | string | null;
};

type ReviewTotalsRow = RowDataPacket & {
  average_rating: number | string | null;
  review_count: number | string;
};

export async function getAdminCampaignReport(
  campaignId: number,
): Promise<AdminCampaignReport | null> {
  const [
    campaignRows,
    applicationRows,
    collaborationRows,
    paymentRows,
    performanceRows,
    reviewRows,
  ] = await Promise.all([
    query<CampaignDetailRow[]>(
      `SELECT c.campaign_id, c.campaign_name, c.description, b.brand_name,
              cc.category_name, c.status, c.budget, c.min_followers,
              c.creator_limit, c.start_date, c.end_date
       FROM campaigns c
       INNER JOIN brands b ON b.brand_id = c.brand_id
       LEFT JOIN campaign_categories cc ON cc.category_id = c.category_id
       WHERE c.campaign_id = ?
       LIMIT 1`,
      [campaignId],
    ),
    query<CountRow[]>(
      `SELECT status, COUNT(*) AS count
       FROM applications WHERE campaign_id = ? GROUP BY status`,
      [campaignId],
    ),
    query<CountRow[]>(
      `SELECT co.status, COUNT(*) AS count
       FROM collaborations co
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.campaign_id = ?
       GROUP BY co.status`,
      [campaignId],
    ),
    query<PaymentTotalsRow[]>(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN p.status = 'Paid' THEN p.amount ELSE 0 END), 0) AS paid_total,
              COALESCE(SUM(CASE WHEN p.status = 'Pending' THEN p.amount ELSE 0 END), 0) AS pending_total
       FROM payments p
       INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.campaign_id = ?`,
      [campaignId],
    ),
    query<PerformanceTotalsRow[]>(
      `SELECT COALESCE(SUM(pm.views), 0) AS views,
              COALESCE(SUM(pm.likes), 0) AS likes,
              COALESCE(SUM(pm.comments), 0) AS comments,
              COALESCE(SUM(pm.shares), 0) AS shares,
              COALESCE(SUM(pm.clicks), 0) AS clicks
       FROM performance_metrics pm
       INNER JOIN collaborations co ON co.collaboration_id = pm.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.campaign_id = ?`,
      [campaignId],
    ),
    query<ReviewTotalsRow[]>(
      `SELECT AVG(rv.rating) AS average_rating, COUNT(rv.review_id) AS review_count
       FROM reviews rv
       INNER JOIN collaborations co ON co.collaboration_id = rv.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.campaign_id = ?`,
      [campaignId],
    ),
  ]);

  const campaign = campaignRows[0];
  if (!campaign) return null;

  const payments = paymentRows[0];
  const performance = performanceRows[0];
  const reviews = reviewRows[0];

  return {
    campaignId: campaign.campaign_id,
    campaignName: campaign.campaign_name,
    description: campaign.description,
    brandName: campaign.brand_name,
    categoryName: campaign.category_name,
    status: campaign.status,
    budget: decimal(campaign.budget),
    minFollowers: String(campaign.min_followers),
    creatorLimit: integer(campaign.creator_limit),
    startDate: campaign.start_date,
    endDate: campaign.end_date,
    applications: countRows(applicationRows),
    collaborations: countRows(collaborationRows),
    payments: {
      count: integer(payments?.count),
      paidTotal: decimal(payments?.paid_total),
      pendingTotal: decimal(payments?.pending_total),
    },
    performance: {
      views: String(performance?.views ?? "0"),
      likes: String(performance?.likes ?? "0"),
      comments: String(performance?.comments ?? "0"),
      shares: String(performance?.shares ?? "0"),
      clicks: String(performance?.clicks ?? "0"),
    },
    averageRating:
      reviews?.average_rating == null ? null : String(reviews.average_rating),
    reviewCount: integer(reviews?.review_count),
  };
}
