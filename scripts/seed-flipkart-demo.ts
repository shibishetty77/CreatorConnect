import type { RowDataPacket } from "mysql2/promise";

import {
  createBrandCampaign,
  listBrandCampaigns,
} from "../src/lib/repositories/brand-campaigns";
import {
  acceptBrandApplication,
  listBrandApplications,
} from "../src/lib/repositories/brand-applications";
import { applyCreatorToCampaign } from "../src/lib/repositories/campaign-discovery";
import {
  createDeliverable,
  listBrandDeliverables,
  listCreatorDeliverables,
  reviewSubmission,
  submitDeliverable,
} from "../src/lib/repositories/delivery";
import {
  createPayment,
  listPaymentsForRole,
} from "../src/lib/repositories/finance";
import {
  listBrandCollaborations,
  listCreatorCollaborations,
} from "../src/lib/repositories/collaborations";
import { listCreatorApplications } from "../src/lib/repositories/applications";
import {
  getBrandDashboardData,
  getCreatorDashboardData,
} from "../src/lib/repositories/dashboard";
import {
  recordApplicationAccepted,
  recordCampaignApplication,
  recordDeliverableSubmitted,
  recordPaymentCreated,
} from "../src/lib/platform-events";
import { closePool, pool } from "../src/lib/db";
import { closeMongoConnection } from "../src/lib/mongodb";
import { brandCampaignCreateSchema } from "../src/lib/validations/campaigns";

const BRAND_USERNAME = "flipkart";
const CREATOR_USERNAME =
  process.env.DEMO_CREATOR_USERNAME?.trim() || "shetty_shibi";
const CAMPAIGN_NAME = "Flipkart Creator Showcase - Demo Workflow";
const CAMPAIGN_DESCRIPTION =
  "Demo campaign for a Flipkart product showcase, with a creator application, " +
  "active collaboration, scheduled content milestones, and a pending settlement.";
const CAMPAIGN_BUDGET = "95000.00";
const AGREED_AMOUNT = "42000.00";
const PAYMENT_AMOUNT = AGREED_AMOUNT;
const COMPLETED_DELIVERABLE_URL =
  "https://example.com/creatorconnect-demo/flipkart-showcase-reel";

type BrandRow = RowDataPacket & {
  brand_id: number;
  user_id: number;
  role: string;
};

type CreatorRow = RowDataPacket & {
  creator_id: number;
  user_id: number;
  role: string;
};

type DateRow = RowDataPacket & { current_date_value: string };

type CampaignRow = RowDataPacket & {
  campaign_id: number;
  campaign_name: string;
  description: string | null;
  budget: string | number;
  status: "Open" | "Ongoing" | "Completed";
  start_date: string;
  end_date: string;
  creator_limit: number | string;
  min_followers: number | string;
};

type ApplicationRow = RowDataPacket & {
  application_id: number;
  status: "Pending" | "Accepted" | "Rejected";
  collaboration_id: number | null;
  collaboration_status: "Pending" | "Active" | "Completed" | "Rejected" | null;
  requested_by: "Brand" | "Creator" | null;
};

type DeliverableRow = RowDataPacket & {
  deliverable_id: number;
  status: "Pending" | "Completed";
  due_date: string;
};

type SubmissionRow = RowDataPacket & {
  submission_id: number;
  content_url: string;
  approval_status: "Pending" | "Approved" | "Rejected";
};

type PaymentRow = RowDataPacket & {
  payment_id: number;
  amount: string | number;
  status: "Pending" | "Paid";
};

type SeedOutcome = {
  id: number;
  created: boolean;
};

function assertSafeEnvironment(): void {
  const host = (process.env.DB_HOST ?? "").trim().toLowerCase();
  const database = (process.env.DB_NAME ?? "").trim().toLowerCase();

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed the Flipkart demo in production.");
  }
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error("Refusing to seed a non-local MySQL server.");
  }
  if (!database.startsWith("creatorconnect") || /prod|production|live/.test(database)) {
    throw new Error("Refusing to seed a production-looking database.");
  }
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function decimal(value: string | number): string {
  return Number(value).toFixed(2);
}

async function acquireSeedLock(): Promise<{
  release: () => Promise<void>;
}> {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query<
      Array<RowDataPacket & { acquired: number | null }>
    >("SELECT GET_LOCK('creatorconnect:flipkart-demo-workflow', 10) AS acquired");
    if (Number(rows[0]?.acquired) !== 1) {
      throw new Error("Could not acquire the Flipkart demo seed lock.");
    }
    return {
      release: async () => {
        try {
          await connection.query(
            "SELECT RELEASE_LOCK('creatorconnect:flipkart-demo-workflow')",
          );
        } finally {
          connection.release();
        }
      },
    };
  } catch (error) {
    connection.release();
    throw error;
  }
}

async function findOrCreateCampaign(
  brandId: number,
  currentDate: string,
): Promise<SeedOutcome> {
  const [rows] = await pool.execute<CampaignRow[]>(
    `SELECT campaign_id, campaign_name, description, budget, status,
            start_date, end_date, creator_limit, min_followers
     FROM campaigns
     WHERE brand_id = ? AND campaign_name = ?
     LIMIT 1`,
    [brandId, CAMPAIGN_NAME],
  );
  const existing = rows[0];
  if (existing) {
    if (
      existing.description !== CAMPAIGN_DESCRIPTION ||
      decimal(existing.budget) !== CAMPAIGN_BUDGET ||
      Number(existing.min_followers) !== 0 ||
      Number(existing.creator_limit) !== 1
    ) {
      throw new Error(
        "The existing Flipkart demo campaign has been customized; it was not changed.",
      );
    }
    return { id: existing.campaign_id, created: false };
  }

  const input = brandCampaignCreateSchema.parse({
    campaignName: CAMPAIGN_NAME,
    description: CAMPAIGN_DESCRIPTION,
    categoryId: null,
    budget: CAMPAIGN_BUDGET,
    minFollowers: 0,
    creatorLimit: 1,
    startDate: currentDate,
    endDate: addDays(currentDate, 90),
  });
  return {
    id: await createBrandCampaign(brandId, input),
    created: true,
  };
}

async function findOrCreateApplication(input: {
  brandId: number;
  brandUserId: number;
  creatorId: number;
  creatorUserId: number;
  campaignId: number;
  startDate: string;
  endDate: string;
}): Promise<SeedOutcome & { collaborationId: number }> {
  const [rows] = await pool.execute<ApplicationRow[]>(
    `SELECT a.application_id, a.status, co.collaboration_id,
            co.status AS collaboration_status, co.requested_by
     FROM applications a
     LEFT JOIN collaborations co ON co.application_id = a.application_id
     WHERE a.campaign_id = ? AND a.creator_id = ?
     LIMIT 1`,
    [input.campaignId, input.creatorId],
  );
  const existing = rows[0];
  let applicationId: number;
  let created = false;
  let applicationStatus: ApplicationRow["status"];
  let collaborationId: number | null;

  if (existing) {
    applicationId = existing.application_id;
    applicationStatus = existing.status;
    collaborationId = existing.collaboration_id;
    if (existing.requested_by !== null) {
      throw new Error(
        "The demo application is already linked to a collaboration request; it was not changed.",
      );
    }
    if (applicationStatus === "Rejected") {
      throw new Error(
        "The demo application was rejected; it was not recreated or changed.",
      );
    }
  } else {
    const result = await applyCreatorToCampaign(
      input.creatorId,
      input.campaignId,
    );
    applicationId = result.applicationId;
    applicationStatus = result.status;
    collaborationId = null;
    created = true;
  }

  await recordCampaignApplication({
    applicationId,
    campaignId: input.campaignId,
    creatorUserId: input.creatorUserId,
    creatorRole: "Creator",
  });

  if (applicationStatus === "Pending") {
    if (collaborationId !== null) {
      throw new Error(
        "The pending demo application already has a collaboration; it was not changed.",
      );
    }
    const accepted = await acceptBrandApplication(
      input.brandId,
      applicationId,
      {
        agreedAmount: AGREED_AMOUNT,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    );
    collaborationId = accepted.collaborationId;
    applicationStatus = "Accepted";
  }

  if (applicationStatus !== "Accepted" || collaborationId === null) {
    throw new Error("The demo application could not be accepted safely.");
  }

  const [collaborationRows] = await pool.execute<
    Array<RowDataPacket & { status: string; requested_by: string | null }>
  >(
    `SELECT status, requested_by
     FROM collaborations
     WHERE collaboration_id = ? AND application_id = ?
     LIMIT 1`,
    [collaborationId, applicationId],
  );
  if (
    collaborationRows[0]?.status !== "Active" ||
    collaborationRows[0]?.requested_by !== null
  ) {
    throw new Error(
      "The demo application is not linked to an active application-backed collaboration.",
    );
  }

  await recordApplicationAccepted({
    applicationId,
    collaborationId,
    brandUserId: input.brandUserId,
  });

  return { id: applicationId, created, collaborationId };
}

async function findOrCreateDeliverable(input: {
  brandId: number;
  collaborationId: number;
  contentType: "Reel" | "Story";
  dueDate: string;
}): Promise<SeedOutcome> {
  const [rows] = await pool.execute<DeliverableRow[]>(
    `SELECT deliverable_id, status, due_date
     FROM deliverables
     WHERE collaboration_id = ? AND content_type = ? AND due_date = ?
     ORDER BY deliverable_id
     LIMIT 1`,
    [input.collaborationId, input.contentType, input.dueDate],
  );
  const existing = rows[0];
  if (existing) {
    return { id: existing.deliverable_id, created: false };
  }
  const result = await createDeliverable(
    input.brandId,
    input.collaborationId,
    { contentType: input.contentType, dueDate: input.dueDate },
  );
  return { id: result.deliverableId, created: true };
}

async function ensureApprovedSubmission(input: {
  brandId: number;
  creatorId: number;
  creatorUserId: number;
  deliverableId: number;
}): Promise<SeedOutcome> {
  const [deliverableRows] = await pool.execute<
    Array<RowDataPacket & { status: "Pending" | "Completed" }>
  >(
    "SELECT status FROM deliverables WHERE deliverable_id = ? LIMIT 1",
    [input.deliverableId],
  );
  if (!deliverableRows[0]) {
    throw new Error("The showcase deliverable disappeared.");
  }

  const [submissionRows] = await pool.execute<SubmissionRow[]>(
    `SELECT submission_id, content_url, approval_status
     FROM content_submissions
     WHERE deliverable_id = ?
     ORDER BY submission_id DESC
     LIMIT 1`,
    [input.deliverableId],
  );
  let submission = submissionRows[0];
  let created = false;

  if (!submission || submission.approval_status === "Rejected") {
    const result = await submitDeliverable(
      input.creatorId,
      input.deliverableId,
      COMPLETED_DELIVERABLE_URL,
    );
    const [newRows] = await pool.execute<SubmissionRow[]>(
      `SELECT submission_id, content_url, approval_status
       FROM content_submissions
       WHERE submission_id = ?
       LIMIT 1`,
      [result.submissionId],
    );
    submission = newRows[0];
    created = true;
  }
  if (!submission) {
    throw new Error("The demo content submission could not be loaded.");
  }

  await recordDeliverableSubmitted({
    deliverableId: input.deliverableId,
    submissionId: submission.submission_id,
    creatorUserId: input.creatorUserId,
    creatorRole: "Creator",
  });

  if (submission.approval_status === "Pending") {
    await reviewSubmission(
      input.brandId,
      submission.submission_id,
      "Approved",
    );
  } else if (submission.approval_status !== "Approved") {
    throw new Error("The latest demo submission is not eligible for review.");
  }

  const [verifiedRows] = await pool.execute<
    Array<
      RowDataPacket & {
        deliverable_status: string;
        approval_status: string;
      }
    >
  >(
    `SELECT d.status AS deliverable_status, cs.approval_status
     FROM deliverables d
     JOIN content_submissions cs ON cs.deliverable_id = d.deliverable_id
     WHERE d.deliverable_id = ? AND cs.submission_id = ?`,
    [input.deliverableId, submission.submission_id],
  );
  if (
    verifiedRows[0]?.deliverable_status !== "Completed" ||
    verifiedRows[0]?.approval_status !== "Approved"
  ) {
    throw new Error("The showcase submission did not complete successfully.");
  }
  return { id: submission.submission_id, created };
}

async function findOrCreatePayment(
  brandId: number,
  brandUserId: number,
  collaborationId: number,
): Promise<SeedOutcome> {
  const [rows] = await pool.execute<PaymentRow[]>(
    `SELECT payment_id, amount, status
     FROM payments
     WHERE collaboration_id = ?
     LIMIT 1`,
    [collaborationId],
  );
  const existing = rows[0];
  if (existing) {
    if (
      decimal(existing.amount) !== PAYMENT_AMOUNT ||
      existing.status !== "Pending"
    ) {
      throw new Error(
        "An existing settlement for the demo collaboration differs from the seed; it was not changed.",
      );
    }
    await recordPaymentCreated({
      paymentId: existing.payment_id,
      brandUserId,
    });
    return { id: existing.payment_id, created: false };
  }

  const result = await createPayment({
    brandId,
    collaborationId,
    payment: {
      amount: PAYMENT_AMOUNT,
      status: "Pending",
      paymentDate: null,
    },
  });
  if (result.collaborationStatus !== "Active") {
    throw new Error(
      "The pending demo payment unexpectedly changed collaboration status.",
    );
  }
  await recordPaymentCreated({
    paymentId: result.paymentId,
    brandUserId,
  });
  return { id: result.paymentId, created: true };
}

async function verifyMongoEvents(input: {
  brandUserId: number;
  creatorUserId: number;
  applicationId: number;
  collaborationId: number;
  submissionId: number;
  paymentId: number;
}): Promise<void> {
  const { getMongoDatabase } = await import("../src/lib/mongodb");
  const database = await getMongoDatabase();
  const expectedNotifications = [
    `application:${input.applicationId}:brand`,
    `application:${input.applicationId}:accepted`,
    `submission:${input.submissionId}:brand`,
    `payment:${input.paymentId}:created`,
  ];
  const expectedActivities = [
    `application:${input.applicationId}:submitted`,
    `collaboration:${input.collaborationId}:started`,
    `submission:${input.submissionId}:activity`,
    `payment:${input.paymentId}:created-activity`,
  ];
  const [notifications, activities] = await Promise.all([
    database.collection("notifications").countDocuments({
      dedupeKey: { $in: expectedNotifications },
      userId: { $in: [input.brandUserId, input.creatorUserId] },
    }),
    database.collection("activity_logs").countDocuments({
      dedupeKey: { $in: expectedActivities },
      actorId: { $in: [input.brandUserId, input.creatorUserId] },
    }),
  ]);
  if (
    notifications !== expectedNotifications.length ||
    activities !== expectedActivities.length
  ) {
    throw new Error(
      `MongoDB demo events are incomplete (notifications ${notifications}/${expectedNotifications.length}, ` +
        `activities ${activities}/${expectedActivities.length}). Rerun after MongoDB is available.`,
    );
  }
}

async function main(): Promise<void> {
  assertSafeEnvironment();
  const seedLock = await acquireSeedLock();
  try {
    const [brandRows] = await pool.execute<BrandRow[]>(
      `SELECT b.brand_id, u.user_id, u.role
       FROM users u
       JOIN brands b ON b.user_id = u.user_id
       WHERE u.username = ?
       LIMIT 1`,
      [BRAND_USERNAME],
    );
    const brand = brandRows[0];
    if (!brand || brand.role !== "Brand") {
      throw new Error(
        `The existing ${BRAND_USERNAME} Brand account/profile was not found.`,
      );
    }

    const [creatorRows] = await pool.execute<CreatorRow[]>(
      `SELECT c.creator_id, u.user_id, u.role
       FROM users u
       JOIN creators c ON c.user_id = u.user_id
       WHERE u.username = ?
       LIMIT 1`,
      [CREATOR_USERNAME],
    );
    const creator = creatorRows[0];
    if (!creator || creator.role !== "Creator") {
      throw new Error(
        `Existing Creator account "${CREATOR_USERNAME}" was not found.`,
      );
    }

    const [accountRows] = await pool.execute<
      Array<RowDataPacket & { total: number }>
    >(
      "SELECT COUNT(*) AS total FROM creator_social_accounts WHERE creator_id = ?",
      [creator.creator_id],
    );
    if (Number(accountRows[0]?.total ?? 0) === 0) {
      throw new Error(
        `Creator "${CREATOR_USERNAME}" has no social accounts and is not eligible to apply.`,
      );
    }
    const [dateRows] = await pool.query<DateRow[]>(
      "SELECT CURRENT_DATE() AS current_date_value",
    );
    const currentDate = dateRows[0]?.current_date_value;
    if (!currentDate) {
      throw new Error("MySQL did not return its current date.");
    }

    const campaign = await findOrCreateCampaign(brand.brand_id, currentDate);
    const [campaignRows] = await pool.execute<CampaignRow[]>(
      `SELECT campaign_id, campaign_name, description, budget, status,
              start_date, end_date, creator_limit, min_followers
       FROM campaigns
       WHERE campaign_id = ? AND brand_id = ?
       LIMIT 1`,
      [campaign.id, brand.brand_id],
    );
    const persistedCampaign = campaignRows[0];
    if (!persistedCampaign) {
      throw new Error("The Flipkart demo campaign could not be loaded.");
    }

    const collaborationEnd = addDays(persistedCampaign.start_date, 60);
    const application = await findOrCreateApplication({
      brandId: brand.brand_id,
      brandUserId: brand.user_id,
      creatorId: creator.creator_id,
      creatorUserId: creator.user_id,
      campaignId: campaign.id,
      startDate: persistedCampaign.start_date,
      endDate:
        collaborationEnd > persistedCampaign.end_date
          ? persistedCampaign.end_date
          : collaborationEnd,
    });

    const completedDeliverable = await findOrCreateDeliverable({
      brandId: brand.brand_id,
      collaborationId: application.collaborationId,
      contentType: "Reel",
      dueDate: addDays(persistedCampaign.start_date, 14),
    });
    const completedSubmission = await ensureApprovedSubmission({
      brandId: brand.brand_id,
      creatorId: creator.creator_id,
      creatorUserId: creator.user_id,
      deliverableId: completedDeliverable.id,
    });
    const pendingDeliverable = await findOrCreateDeliverable({
      brandId: brand.brand_id,
      collaborationId: application.collaborationId,
      contentType: "Story",
      dueDate: addDays(persistedCampaign.start_date, 30),
    });

    const payment = await findOrCreatePayment(
      brand.brand_id,
      brand.user_id,
      application.collaborationId,
    );

    const [
      brandApplications,
      brandCampaigns,
      brandCollaborations,
      brandDeliverables,
      brandPayments,
      creatorCollaborations,
      creatorDeliverables,
      creatorPayments,
      creatorApplicationPage,
      brandDashboard,
      creatorDashboard,
    ] =
      await Promise.all([
        listBrandApplications(brand.brand_id),
        listBrandCampaigns(brand.brand_id),
        listBrandCollaborations(brand.brand_id),
        listBrandDeliverables(brand.brand_id),
        listPaymentsForRole("Brand", brand.brand_id),
        listCreatorCollaborations(creator.creator_id),
        listCreatorDeliverables(creator.creator_id),
        listPaymentsForRole("Creator", creator.creator_id),
        listCreatorApplications(creator.creator_id, {
          page: 1,
          pageSize: 50,
        }),
        getBrandDashboardData(brand.brand_id),
        getCreatorDashboardData(creator.creator_id),
      ]);

    if (
      !brandApplications.some(
        (item) => item.applicationId === application.id && item.status === "Accepted",
      ) ||
      !brandCampaigns.some((item) => item.campaignId === campaign.id) ||
      !brandCollaborations.some(
        (item) => item.collaborationId === application.collaborationId && item.status === "Active",
      ) ||
      !brandDeliverables.some((item) => item.deliverableId === completedDeliverable.id) ||
      !brandDeliverables.some((item) => item.deliverableId === pendingDeliverable.id) ||
      !brandPayments.some((item) => item.paymentId === payment.id) ||
      !creatorApplicationPage.applications.some(
        (item) => item.applicationId === application.id,
      ) ||
      !creatorCollaborations.some(
        (item) => item.collaborationId === application.collaborationId,
      ) ||
      !creatorDeliverables.some(
        (item) => item.deliverableId === completedDeliverable.id,
      ) ||
      !creatorPayments.some((item) => item.paymentId === payment.id) ||
      !brandDashboard ||
      brandDashboard.campaigns.total < 1 ||
      brandDashboard.applications.byStatus.Accepted < 1 ||
      brandDashboard.collaborations.byStatus.Active < 1 ||
      brandDashboard.deliverables.byStatus.Pending < 1 ||
      brandDashboard.deliverables.byStatus.Completed < 1 ||
      Number(brandDashboard.payments.pendingTotal) < Number(PAYMENT_AMOUNT) ||
      !brandDashboard.recentActivity.some((item) =>
        item.title.includes(CAMPAIGN_NAME),
      ) ||
      !creatorDashboard ||
      creatorDashboard.applications.total < 1 ||
      creatorDashboard.collaborations.byStatus.Active < 1 ||
      creatorDashboard.deliverables.byStatus.Pending < 1 ||
      creatorDashboard.deliverables.byStatus.Completed < 1 ||
      Number(creatorDashboard.payments.pendingTotal) < Number(PAYMENT_AMOUNT)
    ) {
      throw new Error(
        "Repository-level brand/creator visibility or dashboard metrics verification failed.",
      );
    }

    await verifyMongoEvents({
      brandUserId: brand.user_id,
      creatorUserId: creator.user_id,
      applicationId: application.id,
      collaborationId: application.collaborationId,
      submissionId: completedSubmission.id,
      paymentId: payment.id,
    });

    const record = (label: string, outcome: SeedOutcome) =>
      `${label}: ${outcome.id} (${outcome.created ? "created" : "reused"})`;
    console.log("Flipkart end-to-end demo workflow verified.");
    console.log(`Brand: ${BRAND_USERNAME} (brand ${brand.brand_id})`);
    console.log(`Creator: ${CREATOR_USERNAME} (creator ${creator.creator_id})`);
    console.log(record("Campaign", campaign));
    console.log(record("Accepted application", application));
    console.log(`Active collaboration: ${application.collaborationId}`);
    console.log(record("Completed Reel deliverable", completedDeliverable));
    console.log(record("Approved Reel submission", completedSubmission));
    console.log(record("Pending Story deliverable", pendingDeliverable));
    console.log(record("Pending full-settlement payment", payment));
    console.log(
      `Brand repository visibility: ${brandApplications.length} applications, ` +
        `${brandCampaigns.length} campaigns, ` +
        `${brandCollaborations.length} active/completed collaborations, ` +
        `${brandDeliverables.length} deliverables, ${brandPayments.length} payments.`,
    );
    console.log(
      `Creator repository visibility: ${creatorApplicationPage.total} applications, ` +
        `${creatorCollaborations.length} active/completed collaborations, ` +
        `${creatorDeliverables.length} deliverables, ${creatorPayments.length} payments.`,
    );
    console.log(
      `Dashboard verification: ${brandDashboard?.campaigns.total} brand campaigns, ` +
        `${brandDashboard?.collaborations.byStatus.Active} active brand collaborations, ` +
        `${brandDashboard?.deliverables.byStatus.Pending} pending brand deliverables, ` +
        `INR ${brandDashboard?.payments.pendingTotal} pending brand payments; ` +
        `${creatorDashboard?.applications.total} creator applications and ` +
        `${creatorDashboard?.collaborations.byStatus.Active} active creator collaborations.`,
    );
    console.log(
      "MongoDB verified: 4 deduplicated notifications and 4 activity log entries for application, acceptance, submission, and payment events.",
    );
  } finally {
    await seedLock.release();
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Flipkart demo seed failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoConnection();
    await closePool();
  });
