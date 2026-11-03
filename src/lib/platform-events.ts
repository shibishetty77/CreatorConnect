import type { RowDataPacket } from "mysql2/promise";

import type { Role } from "@/lib/auth/constants";
import { query } from "@/lib/db";
import {
  createActivity,
  createNotification,
  type ActivityInput,
  type NotificationInput,
} from "@/lib/repositories/mongo-platform";

async function bestEffortMongoEvent(
  label: string,
  write: () => Promise<void>,
): Promise<void> {
  try {
    await write();
  } catch (error) {
    console.error(
      `${label} could not be recorded in MongoDB:`,
      error instanceof Error ? error.name : "Unknown error",
    );
  }
}

async function loadEventRow<T>(
  label: string,
  load: () => Promise<T | null>,
): Promise<T | null> {
  try {
    const row = await load();
    if (!row) {
      console.error(`${label} context was not found for the MongoDB event.`);
    }
    return row;
  } catch (error) {
    console.error(
      `${label} context could not be loaded for MongoDB event:`,
      error instanceof Error ? error.name : "Unknown error",
    );
    return null;
  }
}

export async function recordMongoActivity(input: ActivityInput): Promise<void> {
  await bestEffortMongoEvent("Platform activity", () => createActivity(input));
}

export async function sendMongoNotification(
  input: NotificationInput,
): Promise<void> {
  await bestEffortMongoEvent("Platform notification", () =>
    createNotification(input),
  );
}

type CampaignEventRow = RowDataPacket & {
  brand_user_id: number;
  brand_name: string;
  campaign_name: string;
};

export async function recordCampaignApplication(input: {
  applicationId: number;
  campaignId: number;
  creatorUserId: number;
  creatorRole: Role;
}): Promise<void> {
  const campaign = await loadEventRow("Campaign application", async () =>
    (await query<CampaignEventRow[]>(
      `SELECT brand_user.user_id AS brand_user_id, b.brand_name, ca.campaign_name
       FROM campaigns ca
       INNER JOIN brands b ON b.brand_id = ca.brand_id
       INNER JOIN users brand_user ON brand_user.user_id = b.user_id
       WHERE ca.campaign_id = ?
       LIMIT 1`,
      [input.campaignId],
    ))[0] ?? null,
  );
  if (!campaign) return;

  await Promise.all([
    sendMongoNotification({
      userId: campaign.brand_user_id,
      userRole: "Brand",
      title: "New campaign application",
      message: `A creator applied to ${campaign.campaign_name}.`,
      type: "application_received",
      relatedEntityId: input.applicationId,
      relatedEntityType: "application",
      metadata: { campaignName: campaign.campaign_name },
      dedupeKey: `application:${input.applicationId}:brand`,
    }),
    recordMongoActivity({
      actorId: input.creatorUserId,
      actorRole: input.creatorRole,
      action: "campaign_application_submitted",
      entityType: "application",
      entityId: input.applicationId,
      description: `Applied to ${campaign.campaign_name}.`,
      metadata: { campaignId: input.campaignId },
      dedupeKey: `application:${input.applicationId}:submitted`,
    }),
  ]);
}

type AcceptedApplicationRow = RowDataPacket & {
  creator_user_id: number;
  creator_username: string;
  campaign_name: string;
};

export async function recordApplicationAccepted(input: {
  applicationId: number;
  collaborationId: number;
  brandUserId: number;
}): Promise<void> {
  const accepted = await loadEventRow("Application acceptance", async () =>
    (await query<AcceptedApplicationRow[]>(
      `SELECT creator_user.user_id AS creator_user_id,
              creator_user.username AS creator_username,
              ca.campaign_name
       FROM applications a
       INNER JOIN creators cr ON cr.creator_id = a.creator_id
       INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE a.application_id = ?
       LIMIT 1`,
      [input.applicationId],
    ))[0] ?? null,
  );
  if (!accepted) return;

  await Promise.all([
    sendMongoNotification({
      userId: accepted.creator_user_id,
      userRole: "Creator",
      title: "Your application was accepted",
      message: `Your application to ${accepted.campaign_name} was accepted.`,
      type: "application_accepted",
      relatedEntityId: input.collaborationId,
      relatedEntityType: "collaboration",
      metadata: { campaignName: accepted.campaign_name },
      dedupeKey: `application:${input.applicationId}:accepted`,
    }),
    recordMongoActivity({
      actorId: input.brandUserId,
      actorRole: "Brand",
      action: "collaboration_started",
      entityType: "collaboration",
      entityId: input.collaborationId,
      description: `Started a collaboration for ${accepted.campaign_name}.`,
      metadata: { creator: accepted.creator_username },
      dedupeKey: `collaboration:${input.collaborationId}:started`,
    }),
  ]);
}

type DeliverableEventRow = RowDataPacket & {
  creator_user_id: number;
  brand_user_id: number;
  campaign_name: string;
  deliverable_id: number;
};

async function getDeliverableEventRow(
  deliverableId: number,
): Promise<DeliverableEventRow | null> {
  return loadEventRow("Deliverable", async () =>
    (await query<DeliverableEventRow[]>(
      `SELECT creator_user.user_id AS creator_user_id,
              brand_user.user_id AS brand_user_id,
              ca.campaign_name, d.deliverable_id
       FROM deliverables d
       INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN creators cr ON cr.creator_id = a.creator_id
       INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN brands b ON b.brand_id = ca.brand_id
       INNER JOIN users brand_user ON brand_user.user_id = b.user_id
       WHERE d.deliverable_id = ?
       LIMIT 1`,
      [deliverableId],
    ))[0] ?? null,
  );
}

export async function recordDeliverableSubmitted(input: {
  deliverableId: number;
  submissionId: number;
  creatorUserId: number;
  creatorRole: Role;
}): Promise<void> {
  const deliverable = await getDeliverableEventRow(input.deliverableId);
  if (!deliverable) return;
  await Promise.all([
    sendMongoNotification({
      userId: deliverable.brand_user_id,
      userRole: "Brand",
      title: "Deliverable submitted",
      message: `A new submission is ready to review for ${deliverable.campaign_name}.`,
      type: "deliverable_submitted",
      relatedEntityId: deliverable.deliverable_id,
      relatedEntityType: "deliverable",
      metadata: { submissionId: input.submissionId },
      dedupeKey: `submission:${input.submissionId}:brand`,
    }),
    recordMongoActivity({
      actorId: input.creatorUserId,
      actorRole: input.creatorRole,
      action: "deliverable_submitted",
      entityType: "deliverable",
      entityId: deliverable.deliverable_id,
      description: `Submitted content for ${deliverable.campaign_name}.`,
      metadata: { submissionId: input.submissionId },
      dedupeKey: `submission:${input.submissionId}:activity`,
    }),
  ]);
}

export async function recordRevisionRequested(input: {
  submissionId: number;
  brandUserId: number;
}): Promise<void> {
  const deliverable = await loadEventRow("Revision request", async () =>
    (await query<DeliverableEventRow[]>(
      `SELECT creator_user.user_id AS creator_user_id,
              brand_user.user_id AS brand_user_id,
              ca.campaign_name, d.deliverable_id
       FROM content_submissions cs
       INNER JOIN deliverables d ON d.deliverable_id = cs.deliverable_id
       INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN creators cr ON cr.creator_id = a.creator_id
       INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       INNER JOIN brands b ON b.brand_id = ca.brand_id
       INNER JOIN users brand_user ON brand_user.user_id = b.user_id
       WHERE cs.submission_id = ?
       LIMIT 1`,
      [input.submissionId],
    ))[0] ?? null,
  );
  if (!deliverable) return;
  await Promise.all([
    sendMongoNotification({
      userId: deliverable.creator_user_id,
      userRole: "Creator",
      title: "Revision requested",
      message: `The brand requested revisions to your submission for ${deliverable.campaign_name}.`,
      type: "revision_requested",
      relatedEntityId: deliverable.deliverable_id,
      relatedEntityType: "deliverable",
      metadata: { submissionId: input.submissionId },
      dedupeKey: `submission:${input.submissionId}:revision`,
    }),
    recordMongoActivity({
      actorId: input.brandUserId,
      actorRole: "Brand",
      action: "deliverable_revision_requested",
      entityType: "deliverable",
      entityId: deliverable.deliverable_id,
      description: `Requested a revision for ${deliverable.campaign_name}.`,
      metadata: { submissionId: input.submissionId },
      dedupeKey: `submission:${input.submissionId}:revision-activity`,
    }),
  ]);
}

type PaymentEventRow = RowDataPacket & {
  creator_user_id: number;
  campaign_name: string;
};

export async function recordPaymentPaid(input: {
  paymentId: number;
  actorId: number;
  actorRole: "Brand" | "Admin";
}): Promise<void> {
  const payment = await loadEventRow("Payment", async () =>
    (await query<PaymentEventRow[]>(
      `SELECT creator_user.user_id AS creator_user_id, ca.campaign_name
       FROM payments p
       INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       INNER JOIN creators cr ON cr.creator_id = a.creator_id
       INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
       INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
       WHERE p.payment_id = ?
       LIMIT 1`,
      [input.paymentId],
    ))[0] ?? null,
  );
  if (!payment) return;
  await Promise.all([
    sendMongoNotification({
      userId: payment.creator_user_id,
      userRole: "Creator",
      title: "Payment released",
      message: `A payment for ${payment.campaign_name} has been marked paid.`,
      type: "payment_paid",
      relatedEntityId: input.paymentId,
      relatedEntityType: "payment",
      metadata: { campaignName: payment.campaign_name },
      dedupeKey: `payment:${input.paymentId}:paid`,
    }),
    recordMongoActivity({
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: "payment_marked_paid",
      entityType: "payment",
      entityId: input.paymentId,
      description: `Marked a payment for ${payment.campaign_name} as paid.`,
      dedupeKey: `payment:${input.paymentId}:activity`,
    }),
  ]);
}

export async function getCollaborationUserIds(
  collaborationId: number,
): Promise<{ creatorUserId: number; brandUserId: number; campaignName: string } | null> {
  const rows = await query<
    Array<
      RowDataPacket & {
        creator_user_id: number;
        brand_user_id: number;
        campaign_name: string;
      }
    >
  >(
    `SELECT creator_user.user_id AS creator_user_id,
            brand_user.user_id AS brand_user_id,
            ca.campaign_name
     FROM collaborations co
     INNER JOIN applications a ON a.application_id = co.application_id
     INNER JOIN creators cr ON cr.creator_id = a.creator_id
     INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
     INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
     INNER JOIN brands b ON b.brand_id = ca.brand_id
     INNER JOIN users brand_user ON brand_user.user_id = b.user_id
     WHERE co.collaboration_id = ?
     LIMIT 1`,
    [collaborationId],
  );
  const row = rows[0];
  return row
    ? {
        creatorUserId: row.creator_user_id,
        brandUserId: row.brand_user_id,
        campaignName: row.campaign_name,
      }
    : null;
}
