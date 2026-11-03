import {
  ObjectId,
  type Collection,
  type Document,
  type Filter,
  type OptionalUnlessRequiredId,
} from "mongodb";

import type { Role } from "@/lib/auth/constants";
import { getMongoDatabase } from "@/lib/mongodb";

export type NotificationInput = {
  userId: number;
  userRole: Role;
  title: string;
  message: string;
  type: string;
  relatedEntityId: string | number | null;
  relatedEntityType: string | null;
  metadata?: Document;
  dedupeKey?: string;
  createdAt?: Date;
};

export type ActivityInput = {
  actorId: number;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId: string | number;
  description: string;
  metadata?: Document;
  dedupeKey?: string;
  createdAt?: Date;
};

export type MessageAttachment = {
  name: string;
  url: string;
  contentType: string;
  size: number;
};

type NotificationDocument = NotificationInput & {
  isRead: boolean;
  metadata: Document;
  createdAt: Date;
};

type ActivityDocument = ActivityInput & {
  metadata: Document;
  createdAt: Date;
};

type MessageDocument = {
  collaborationId: number;
  senderId: number;
  senderRole: "Creator" | "Brand";
  message: string;
  attachments: MessageAttachment[];
  createdAt: Date;
  updatedAt: Date;
  seedKey?: string;
};

export type NotificationRecord = Omit<NotificationDocument, "dedupeKey"> & {
  id: string;
};

export type ActivityRecord = Omit<ActivityDocument, "dedupeKey"> & {
  id: string;
};

export type MessageRecord = Omit<MessageDocument, "seedKey"> & {
  id: string;
};

function outputRecord<T extends Document>(
  document: T & { _id: ObjectId },
): Omit<T, "_id" | "dedupeKey" | "seedKey"> & { id: string } {
  const {
    _id,
    dedupeKey: internalDedupeKey,
    seedKey: internalSeedKey,
    ...fields
  } = document as T & {
    _id: ObjectId;
    dedupeKey?: string;
    seedKey?: string;
  };
  void internalDedupeKey;
  void internalSeedKey;
  return { ...fields, id: _id.toHexString() };
}

async function collection<T extends Document>(name: string): Promise<Collection<T>> {
  return (await getMongoDatabase()).collection<T>(name);
}

export async function createNotification(
  input: NotificationInput,
): Promise<void> {
  const notifications = await collection<NotificationDocument>("notifications");
  const document: OptionalUnlessRequiredId<NotificationDocument> = {
    ...input,
    isRead: false,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? new Date(),
  };
  if (input.dedupeKey) {
    await notifications.updateOne(
      { dedupeKey: input.dedupeKey },
      { $setOnInsert: document },
      { upsert: true },
    );
    return;
  }
  await notifications.insertOne(document);
}

export async function listNotifications(
  userId: number,
  role: Role,
  unreadOnly = false,
  limit = 100,
): Promise<NotificationRecord[]> {
  const filter: Filter<NotificationDocument> = { userId, userRole: role };
  if (unreadOnly) filter.isRead = false;
  const documents = await (await collection<NotificationDocument>("notifications"))
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .toArray();
  return documents.map((document) => outputRecord(document) as NotificationRecord);
}

export async function getUnreadNotificationCount(
  userId: number,
  role: Role,
): Promise<number> {
  return (await collection<NotificationDocument>("notifications")).countDocuments({
    userId,
    userRole: role,
    isRead: false,
  });
}

export async function markNotificationRead(
  userId: number,
  role: Role,
  notificationId: ObjectId,
): Promise<boolean> {
  const result = await (await collection<NotificationDocument>("notifications"))
    .updateOne(
      { _id: notificationId, userId, userRole: role },
      { $set: { isRead: true } },
    );
  return result.matchedCount === 1;
}

export async function markAllNotificationsRead(
  userId: number,
  role: Role,
): Promise<number> {
  const result = await (await collection<NotificationDocument>("notifications"))
    .updateMany(
      { userId, userRole: role, isRead: false },
      { $set: { isRead: true } },
    );
  return result.modifiedCount;
}

export async function createActivity(input: ActivityInput): Promise<void> {
  const activities = await collection<ActivityDocument>("activity_logs");
  const document: OptionalUnlessRequiredId<ActivityDocument> = {
    ...input,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? new Date(),
  };
  if (input.dedupeKey) {
    await activities.updateOne(
      { dedupeKey: input.dedupeKey },
      { $setOnInsert: document },
      { upsert: true },
    );
    return;
  }
  await activities.insertOne(document);
}

export async function listActivity(input: {
  actorId?: number;
  limit?: number;
}): Promise<ActivityRecord[]> {
  const filter: Filter<ActivityDocument> = {};
  if (input.actorId !== undefined) filter.actorId = input.actorId;
  const documents = await (await collection<ActivityDocument>("activity_logs"))
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(input.limit ?? 50)
    .toArray();
  return documents.map((document) => outputRecord(document) as ActivityRecord);
}

export async function listCollaborationMessages(
  collaborationId: number,
  limit = 100,
): Promise<MessageRecord[]> {
  const documents = await (
    await collection<MessageDocument>("collaboration_messages")
  )
    .find({ collaborationId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .toArray();
  return documents
    .reverse()
    .map((document) => outputRecord(document) as MessageRecord);
}

export async function createCollaborationMessage(input: {
  collaborationId: number;
  senderId: number;
  senderRole: "Creator" | "Brand";
  message: string;
  attachments: MessageAttachment[];
}): Promise<MessageRecord> {
  const now = new Date();
  const document: OptionalUnlessRequiredId<MessageDocument> = {
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const result = await (
    await collection<MessageDocument>("collaboration_messages")
  ).insertOne(document);
  return {
    ...document,
    id: result.insertedId.toHexString(),
  } as MessageRecord;
}

export async function addSeedMessage(input: {
  collaborationId: number;
  senderId: number;
  senderRole: "Creator" | "Brand";
  message: string;
  seedKey: string;
  createdAt: Date;
}): Promise<void> {
  const messages = await collection<MessageDocument>("collaboration_messages");
  await messages.updateOne(
    { seedKey: input.seedKey },
    {
      $setOnInsert: {
        ...input,
        attachments: [],
        updatedAt: input.createdAt,
      },
    },
    { upsert: true },
  );
}

export async function addSeedNotification(
  input: NotificationInput & { isRead: boolean },
): Promise<void> {
  const notifications = await collection<NotificationDocument>("notifications");
  const { isRead, ...document } = input;
  await notifications.updateOne(
    { dedupeKey: input.dedupeKey },
    { $setOnInsert: { ...document, isRead, metadata: input.metadata ?? {} } },
    { upsert: true },
  );
}

export async function addSeedActivity(input: ActivityInput): Promise<void> {
  await createActivity(input);
}

export function parseObjectId(value: string): ObjectId | null {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}
