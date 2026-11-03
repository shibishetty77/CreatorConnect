import type { RowDataPacket } from "mysql2/promise";

import type { Role } from "../src/lib/auth/constants";
import { closeMongoConnection } from "../src/lib/mongodb";
import { closePool, query } from "../src/lib/db";
import {
  addSeedActivity,
  addSeedMessage,
  addSeedNotification,
} from "../src/lib/repositories/mongo-platform";

type UserRow = RowDataPacket & {
  user_id: number;
  username: string;
  role: Role;
};

type CollaborationRow = RowDataPacket & {
  collaboration_id: number;
  creator_user_id: number;
  brand_user_id: number;
  creator_username: string;
  brand_name: string;
  campaign_name: string;
};

async function seedMongoDemo(): Promise<void> {
  const users = await query<UserRow[]>(
    `SELECT user_id, username, role
     FROM users
     WHERE role IN ('Creator', 'Brand', 'Admin')
     ORDER BY user_id`,
  );
  const collaborations = await query<CollaborationRow[]>(
    `SELECT co.collaboration_id,
            creator_user.user_id AS creator_user_id,
            brand_user.user_id AS brand_user_id,
            creator_user.username AS creator_username,
            b.brand_name, ca.campaign_name
     FROM collaborations co
     INNER JOIN applications a ON a.application_id = co.application_id
     INNER JOIN creators cr ON cr.creator_id = a.creator_id
     INNER JOIN users creator_user ON creator_user.user_id = cr.user_id
     INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
     INNER JOIN brands b ON b.brand_id = ca.brand_id
     INNER JOIN users brand_user ON brand_user.user_id = b.user_id
     ORDER BY co.collaboration_id
     LIMIT 100`,
  );

  const rolesPresent = new Set(users.map((user) => user.role));
  const missingRoles = (["Creator", "Brand", "Admin"] as const).filter(
    (role) => !rolesPresent.has(role),
  );
  if (missingRoles.length > 0) {
    throw new Error(
      `MongoDB demo seeding requires existing MySQL accounts for: ${missingRoles.join(", ")}.`,
    );
  }
  if (collaborations.length === 0) {
    throw new Error(
      "MongoDB demo seeding requires an existing MySQL collaboration; no collaboration records were found.",
    );
  }

  const now = Date.now();
  for (const user of users) {
    const userCollaboration = collaborations.find((item) =>
      user.role === "Creator"
        ? item.creator_user_id === user.user_id
        : user.role === "Brand"
          ? item.brand_user_id === user.user_id
          : true,
    );
    const relatedEntityId = userCollaboration?.collaboration_id ?? null;
    await addSeedNotification({
      userId: user.user_id,
      userRole: user.role,
      title: "Welcome to CreatorConnect",
      message: `Your ${user.role.toLowerCase()} workspace is ready.`,
      type: "demo_welcome",
      isRead: false,
      relatedEntityId,
      relatedEntityType: relatedEntityId === null ? null : "collaboration",
      metadata: { demo: true },
      dedupeKey: `demo:notification:${user.user_id}:unread`,
      createdAt: new Date(now - 60 * 60 * 1000),
    });
    await addSeedNotification({
      userId: user.user_id,
      userRole: user.role,
      title: "Demo activity summary",
      message: "Recent application, delivery, and payment updates appear here.",
      type: "demo_summary",
      isRead: true,
      relatedEntityId,
      relatedEntityType: relatedEntityId === null ? null : "collaboration",
      metadata: { demo: true },
      dedupeKey: `demo:notification:${user.user_id}:read`,
      createdAt: new Date(now - 2 * 60 * 60 * 1000),
    });
  }

  for (const [index, collaboration] of collaborations.entries()) {
    const createdAt = new Date(now - index * 60 * 60 * 1000);
    await addSeedActivity({
      actorId: collaboration.brand_user_id,
      actorRole: "Brand",
      action: "collaboration_started",
      entityType: "collaboration",
      entityId: collaboration.collaboration_id,
      description: `Started a collaboration with ${collaboration.creator_username} for ${collaboration.campaign_name}.`,
      metadata: { demo: true, brandName: collaboration.brand_name },
      dedupeKey: `demo:collaboration:${collaboration.collaboration_id}:activity`,
      createdAt,
    });
    await addSeedMessage({
      collaborationId: collaboration.collaboration_id,
      senderId: collaboration.brand_user_id,
      senderRole: "Brand",
      message: `Welcome! Let's coordinate the ${collaboration.campaign_name} deliverables here.`,
      seedKey: `demo:collaboration:${collaboration.collaboration_id}:brand-message`,
      createdAt: new Date(createdAt.getTime() + 1000),
    });
    await addSeedMessage({
      collaborationId: collaboration.collaboration_id,
      senderId: collaboration.creator_user_id,
      senderRole: "Creator",
      message: "Thanks! I will share progress updates in this conversation.",
      seedKey: `demo:collaboration:${collaboration.collaboration_id}:creator-message`,
      createdAt: new Date(createdAt.getTime() + 2000),
    });
  }

  console.info(
    `MongoDB demo seeding complete: ${users.length} users, ${collaborations.length} existing collaborations.`,
  );
}

async function main(): Promise<void> {
  try {
    await seedMongoDemo();
  } finally {
    await Promise.all([closePool(), closeMongoConnection()]);
  }
}

void main().catch((error: unknown) => {
  console.error(
    "MongoDB demo seeding failed:",
    error instanceof Error ? error.name : "Unknown error",
  );
  if (
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable: MONGODB_")
  ) {
    console.error(error.message);
  }
  process.exitCode = 1;
});
