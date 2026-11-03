import {
  MongoClient,
  type Db,
  type Document,
  type MongoClientOptions,
} from "mongodb";

if (typeof window !== "undefined") {
  throw new Error("MongoDB may only be accessed from server-side code.");
}

const globalForMongo = globalThis as typeof globalThis & {
  creatorConnectMongoClient?: MongoClient;
  creatorConnectMongoDbPromise?: Promise<Db>;
};

function requiredMongoEnv(name: "MONGODB_URI" | "MONGODB_DB_NAME"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Configure it in .env to enable MongoDB features.`,
    );
  }
  return value;
}

const notificationValidator: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "userId",
      "userRole",
      "title",
      "message",
      "type",
      "isRead",
      "relatedEntityId",
      "relatedEntityType",
      "metadata",
      "createdAt",
    ],
    properties: {
      userId: { bsonType: "int", minimum: 1 },
      userRole: { enum: ["Creator", "Brand", "Admin"] },
      title: { bsonType: "string", minLength: 1, maxLength: 120 },
      message: { bsonType: "string", minLength: 1, maxLength: 1000 },
      type: { bsonType: "string", minLength: 1, maxLength: 80 },
      isRead: { bsonType: "bool" },
      relatedEntityId: { bsonType: ["string", "int", "null"] },
      relatedEntityType: { bsonType: ["string", "null"] },
      metadata: { bsonType: "object" },
      createdAt: { bsonType: "date" },
      dedupeKey: { bsonType: "string", maxLength: 200 },
    },
  },
};

const activityValidator: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "actorId",
      "actorRole",
      "action",
      "entityType",
      "entityId",
      "description",
      "metadata",
      "createdAt",
    ],
    properties: {
      actorId: { bsonType: "int", minimum: 1 },
      actorRole: { enum: ["Creator", "Brand", "Admin"] },
      action: { bsonType: "string", minLength: 1, maxLength: 80 },
      entityType: { bsonType: "string", minLength: 1, maxLength: 80 },
      entityId: { bsonType: ["string", "int"] },
      description: { bsonType: "string", minLength: 1, maxLength: 1000 },
      metadata: { bsonType: "object" },
      createdAt: { bsonType: "date" },
      dedupeKey: { bsonType: "string", maxLength: 200 },
    },
  },
};

const messageValidator: Document = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "collaborationId",
      "senderId",
      "senderRole",
      "message",
      "attachments",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      collaborationId: { bsonType: "int", minimum: 1 },
      senderId: { bsonType: "int", minimum: 1 },
      senderRole: { enum: ["Creator", "Brand"] },
      message: { bsonType: "string", minLength: 1, maxLength: 2000 },
      attachments: {
        bsonType: "array",
        maxItems: 5,
        items: {
          bsonType: "object",
          required: ["name", "url", "contentType", "size"],
          properties: {
            name: { bsonType: "string", minLength: 1, maxLength: 180 },
            url: { bsonType: "string", minLength: 1, maxLength: 2048 },
            contentType: { bsonType: "string", minLength: 1, maxLength: 120 },
            size: { bsonType: "int", minimum: 1, maximum: 25_000_000 },
          },
        },
      },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
      seedKey: { bsonType: "string", maxLength: 200 },
    },
  },
};

async function prepareCollection(
  db: Db,
  name: string,
  validator: Document,
): Promise<void> {
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  if (exists) {
    await db.command({
      collMod: name,
      validator,
      validationLevel: "strict",
      validationAction: "error",
    });
  } else {
    await db.createCollection(name, {
      validator,
      validationLevel: "strict",
      validationAction: "error",
    });
  }
}

async function initializeDatabase(client: MongoClient): Promise<Db> {
  const db = client.db(requiredMongoEnv("MONGODB_DB_NAME"));
  await Promise.all([
    prepareCollection(db, "notifications", notificationValidator),
    prepareCollection(db, "activity_logs", activityValidator),
    prepareCollection(db, "collaboration_messages", messageValidator),
  ]);
  await Promise.all([
    db.collection("notifications").createIndex(
      { userId: 1, createdAt: -1 },
      { name: "notifications_user_created" },
    ),
    db.collection("notifications").createIndex(
      { userId: 1, isRead: 1 },
      { name: "notifications_user_read" },
    ),
    db.collection("notifications").createIndex(
      { dedupeKey: 1 },
      {
        name: "notifications_dedupe",
        unique: true,
        partialFilterExpression: { dedupeKey: { $type: "string" } },
      },
    ),
    db.collection("activity_logs").createIndex(
      { entityType: 1, entityId: 1, createdAt: -1 },
      { name: "activity_entity_created" },
    ),
    db.collection("activity_logs").createIndex(
      { actorId: 1, createdAt: -1 },
      { name: "activity_actor_created" },
    ),
    db.collection("activity_logs").createIndex(
      { dedupeKey: 1 },
      {
        name: "activity_dedupe",
        unique: true,
        partialFilterExpression: { dedupeKey: { $type: "string" } },
      },
    ),
    db.collection("collaboration_messages").createIndex(
      { collaborationId: 1, createdAt: 1 },
      { name: "messages_collaboration_created" },
    ),
    db.collection("collaboration_messages").createIndex(
      { seedKey: 1 },
      {
        name: "messages_seed_key",
        unique: true,
        partialFilterExpression: { seedKey: { $type: "string" } },
      },
    ),
  ]);
  return db;
}

export async function getMongoDatabase(): Promise<Db> {
  if (!globalForMongo.creatorConnectMongoClient) {
    const options: MongoClientOptions = {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
      appName: "CreatorConnect",
    };
    globalForMongo.creatorConnectMongoClient = new MongoClient(
      requiredMongoEnv("MONGODB_URI"),
      options,
    );
  }

  if (!globalForMongo.creatorConnectMongoDbPromise) {
    const client = globalForMongo.creatorConnectMongoClient;
    globalForMongo.creatorConnectMongoDbPromise = client
      .connect()
      .then(initializeDatabase)
      .catch(async (error: unknown) => {
        delete globalForMongo.creatorConnectMongoDbPromise;
        delete globalForMongo.creatorConnectMongoClient;
        try {
          await client.close();
        } catch (closeError) {
          console.error(
            "MongoDB client could not be closed after initialization failure:",
            closeError instanceof Error ? closeError.name : "Unknown error",
          );
        }
        throw error;
      });
  }

  return globalForMongo.creatorConnectMongoDbPromise;
}

export async function checkMongoConnection(): Promise<{
  database: string;
  version: string;
}> {
  const db = await getMongoDatabase();
  const buildInfo = await db.admin().command({ buildInfo: 1 });
  return {
    database: db.databaseName,
    version: typeof buildInfo.version === "string" ? buildInfo.version : "unknown",
  };
}

export async function closeMongoConnection(): Promise<void> {
  const client = globalForMongo.creatorConnectMongoClient;
  delete globalForMongo.creatorConnectMongoClient;
  delete globalForMongo.creatorConnectMongoDbPromise;
  await client?.close();
}
