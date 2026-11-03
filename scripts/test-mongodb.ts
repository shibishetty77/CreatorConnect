import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import type { RowDataPacket } from "mysql2/promise";

import type { Role } from "../src/lib/auth/constants";
import { closeMongoConnection, getMongoDatabase } from "../src/lib/mongodb";
import { closePool, query } from "../src/lib/db";
import { getCollaborationForActor } from "../src/lib/repositories/collaborations";
import {
  createActivity,
  createCollaborationMessage,
  createNotification,
  getUnreadNotificationCount,
  listActivity,
  listCollaborationMessages,
  markAllNotificationsRead,
  markNotificationRead,
} from "../src/lib/repositories/mongo-platform";

type UserRow = RowDataPacket & { user_id: number; role: Role };
type CollaborationRow = RowDataPacket & {
  collaboration_id: number;
  creator_id: number;
  brand_id: number;
  creator_user_id: number;
  brand_user_id: number;
};

async function runMongoIntegrationTests(): Promise<void> {
  const users = await query<UserRow[]>(
    `SELECT user_id, role
     FROM users
     WHERE role IN ('Creator', 'Brand', 'Admin')
     ORDER BY user_id`,
  );
  const creator = users.find((user) => user.role === "Creator");
  const brand = users.find((user) => user.role === "Brand");
  const admin = users.find((user) => user.role === "Admin");
  assert.ok(creator && brand && admin, "MySQL Creator, Brand, and Admin accounts must exist.");

  const collaborationRows = await query<CollaborationRow[]>(
    `SELECT co.collaboration_id, cr.creator_id, b.brand_id,
            creator_user.user_id AS creator_user_id,
            brand_user.user_id AS brand_user_id
     FROM collaborations co
     INNER JOIN applications a ON a.application_id = co.application_id
     INNER JOIN creators cr ON cr.creator_id = a.creator_id
     INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
     INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
     INNER JOIN brands b ON b.brand_id = ca.brand_id
     INNER JOIN users brand_user ON brand_user.user_id = b.user_id
     ORDER BY co.collaboration_id
     LIMIT 1`,
  );
  const collaboration = collaborationRows[0];
  assert.ok(collaboration, "At least one MySQL collaboration must exist.");

  const unrelatedCreatorRows = await query<
    Array<RowDataPacket & { creator_id: number }>
  >(
    "SELECT creator_id FROM creators WHERE creator_id <> ? ORDER BY creator_id LIMIT 1",
    [collaboration.creator_id],
  );
  const unrelatedCreatorId = unrelatedCreatorRows[0]?.creator_id;
  if (unrelatedCreatorId) {
    const unauthorized = await getCollaborationForActor({
      collaborationId: collaboration.collaboration_id,
      role: "Creator",
      creatorId: unrelatedCreatorId,
      brandId: null,
    });
    assert.equal(unauthorized, null, "Unrelated creators must not access the collaboration.");
  }
  const authorized = await getCollaborationForActor({
    collaborationId: collaboration.collaboration_id,
    role: "Creator",
    creatorId: collaboration.creator_id,
    brandId: null,
  });
  assert.ok(authorized, "A collaboration participant must be authorized.");

  const db = await getMongoDatabase();
  const token = randomUUID();
  const testUserId = 2_000_000_000 + Math.floor(Math.random() * 100_000_000);
  const notificationKeys = [`test:${token}:unread-a`, `test:${token}:unread-b`];
  const activityKey = `test:${token}:activity`;
  let messageId: string | null = null;
  try {
    const beforeCount = await getUnreadNotificationCount(testUserId, "Creator");
    for (const [index, dedupeKey] of notificationKeys.entries()) {
      await createNotification({
        userId: testUserId,
        userRole: "Creator",
        title: `Integration test ${index + 1}`,
        message: "Temporary MongoDB integration test notification.",
        type: "integration_test",
        relatedEntityId: collaboration.collaboration_id,
        relatedEntityType: "collaboration",
        dedupeKey,
      });
    }
    assert.equal(
      await getUnreadNotificationCount(testUserId, "Creator"),
      beforeCount + 2,
      "Unread notification count must include inserted notifications.",
    );
    const first = await db
      .collection("notifications")
      .findOne({ dedupeKey: notificationKeys[0] });
    assert.ok(first?._id instanceof ObjectId);
    assert.equal(
      await markNotificationRead(testUserId, "Brand", first._id),
      false,
      "A different role must not mark a user's notification read.",
    );
    assert.equal(
      await markNotificationRead(testUserId, "Creator", first._id),
      true,
      "The owner must be able to mark a notification read.",
    );
    assert.equal(
      await markAllNotificationsRead(testUserId, "Creator"),
      1,
      "Mark-all must update only remaining unread test notifications.",
    );

    await createActivity({
      actorId: testUserId,
      actorRole: "Creator",
      action: "integration_test",
      entityType: "collaboration",
      entityId: collaboration.collaboration_id,
      description: `Temporary MongoDB activity integration test ${token}.`,
      dedupeKey: activityKey,
    });
    const actorActivity = await listActivity({ actorId: testUserId, limit: 100 });
    assert.ok(actorActivity.some((activity) => activity.description.includes(token)));

    const createdMessage = await createCollaborationMessage({
      collaborationId: collaboration.collaboration_id,
      senderId: collaboration.creator_user_id,
      senderRole: "Creator",
      message: `MongoDB message test ${token}`,
      attachments: [],
    });
    messageId = createdMessage.id;
    const messages = await listCollaborationMessages(collaboration.collaboration_id);
    assert.ok(messages.some((message) => message.id === createdMessage.id));
    console.info("MongoDB notification, activity, messaging, and access-scope tests passed.");
  } finally {
    await db.collection("notifications").deleteMany({
      dedupeKey: { $in: notificationKeys },
    });
    await db.collection("activity_logs").deleteOne({ dedupeKey: activityKey });
    if (messageId) {
      await db
        .collection("collaboration_messages")
        .deleteOne({ _id: new ObjectId(messageId) });
    }
  }
}

async function main(): Promise<void> {
  try {
    await runMongoIntegrationTests();
  } catch (error) {
    console.error(
      "MongoDB integration test failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    if (
      error instanceof Error &&
      error.message.startsWith("Missing required environment variable: MONGODB_")
    ) {
      console.error(error.message);
    }
    process.exitCode = 1;
  } finally {
    await Promise.all([closePool(), closeMongoConnection()]);
  }
}

void main();
