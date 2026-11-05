import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";

import { SignJWT } from "jose";
import { MongoClient } from "mongodb";
import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

const DELAY_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a test port."));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(port);
        }
      });
    });
  });
}

async function waitForServer(
  baseUrl: string,
  child: ChildProcess,
  getLogs: () => string,
): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(
        `Next.js server exited during startup.\n${getLogs().slice(-4000)}`,
      );
    }

    try {
      const response = await fetch(`${baseUrl}/login`, {
        redirect: "manual",
      });

      if (response.status < 500) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for the server.\n${getLogs().slice(-4000)}`);
}

function sessionCookie(
  secret: string,
  userId: number,
  username: string,
  role: "Creator" | "Brand",
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ username, role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(secret))
    .then((token) => `cc_session=${token}`);
}

async function main(): Promise<void> {
  const host = requireEnv("DB_HOST");
  const port = Number(requireEnv("DB_PORT"));
  const user = requireEnv("DB_USER");
  const password = requireEnv("DB_PASSWORD");
  const authSecret = requireEnv("AUTH_SECRET");

  assert.ok(
    authSecret.length >= 32,
    "AUTH_SECRET must be at least 32 characters for the test run.",
  );

  const suffix = `${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const testDatabase = `creatorconnect_collab_test_${suffix}`;
  const testMongoDatabase = `${testDatabase}_mongo`;
  const mongoUri = process.env.MONGODB_URI?.trim() ?? "";
  const mongoClient = mongoUri ? new MongoClient(mongoUri) : null;

  assert.match(testDatabase, /^[a-zA-Z0-9_]+$/);

  const adminConnection = await mysql.createConnection({
    host,
    port,
    user,
    password,
  });

  let testConnection: Connection | null = null;
  let server: ChildProcess | null = null;
  let serverLogs = "";
  let passed = 0;
  let mongoConnected = false;

  try {
    if (mongoClient) {
      await mongoClient.connect();
      mongoConnected = true;
    }

    const mongoDb = mongoClient?.db(testMongoDatabase) ?? null;

    await adminConnection.query(
      `CREATE DATABASE \`${testDatabase}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );

    testConnection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database: testDatabase,
    });

    await testConnection.query(`
      CREATE TABLE users (
        user_id INT NOT NULL AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('Admin','Brand','Creator') NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id),
        UNIQUE KEY username (username),
        UNIQUE KEY email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE creators (
        creator_id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        date_of_birth DATE DEFAULT NULL,
        phone VARCHAR(15) DEFAULT NULL,
        bio TEXT,
        address VARCHAR(255) DEFAULT NULL,
        city VARCHAR(100) DEFAULT NULL,
        state VARCHAR(100) DEFAULT NULL,
        profile_picture VARCHAR(255) DEFAULT NULL,
        profile_picture_url VARCHAR(500) DEFAULT NULL,
        PRIMARY KEY (creator_id),
        UNIQUE KEY user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE brands (
        brand_id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        brand_name VARCHAR(150) NOT NULL,
        industry VARCHAR(100) DEFAULT NULL,
        contact_number VARCHAR(15) DEFAULT NULL,
        address VARCHAR(255) DEFAULT NULL,
        city VARCHAR(100) DEFAULT NULL,
        state VARCHAR(100) DEFAULT NULL,
        PRIMARY KEY (brand_id),
        UNIQUE KEY user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE creator_social_accounts (
        account_id INT NOT NULL AUTO_INCREMENT,
        creator_id INT NOT NULL,
        platform ENUM('Instagram','YouTube','LinkedIn','Twitter','Facebook') NOT NULL,
        username VARCHAR(100) NOT NULL,
        followers BIGINT DEFAULT 0,
        engagement_rate DECIMAL(5,2) DEFAULT 0.00,
        account_url VARCHAR(255) DEFAULT NULL,
        PRIMARY KEY (account_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE campaign_categories (
        category_id INT NOT NULL AUTO_INCREMENT,
        category_name VARCHAR(100) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        PRIMARY KEY (category_id),
        UNIQUE KEY category_name (category_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE campaigns (
        campaign_id INT NOT NULL AUTO_INCREMENT,
        brand_id INT NOT NULL,
        category_id INT DEFAULT NULL,
        campaign_name VARCHAR(150) NOT NULL,
        description TEXT,
        budget DECIMAL(12,2) NOT NULL,
        min_followers BIGINT DEFAULT 0,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status ENUM('Open','Ongoing','Completed') DEFAULT 'Open',
        creator_limit INT DEFAULT 1,
        PRIMARY KEY (campaign_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE applications (
        application_id INT NOT NULL AUTO_INCREMENT,
        campaign_id INT NOT NULL,
        creator_id INT NOT NULL,
        applied_date DATE DEFAULT (CURRENT_DATE),
        status ENUM('Pending','Accepted','Rejected') DEFAULT 'Pending',
        PRIMARY KEY (application_id),
        UNIQUE KEY uq_campaign_creator (campaign_id, creator_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE collaborations (
        collaboration_id INT NOT NULL AUTO_INCREMENT,
        application_id INT NOT NULL,
        title VARCHAR(150) DEFAULT NULL,
        description TEXT,
        deliverable_description TEXT,
        additional_requirements TEXT,
        requested_by ENUM('Brand','Creator') DEFAULT NULL,
        agreed_amount DECIMAL(12,2) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status ENUM('Pending','Active','Completed','Rejected') DEFAULT 'Active',
        decided_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (collaboration_id),
        UNIQUE KEY uq_collaboration_application (application_id),
        KEY idx_collaboration_request_status (requested_by, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE deliverables (
        deliverable_id INT NOT NULL AUTO_INCREMENT,
        collaboration_id INT NOT NULL,
        content_type ENUM('Reel','Story','Post','Video') NOT NULL,
        due_date DATE NOT NULL,
        status ENUM('Pending','Completed') DEFAULT 'Pending',
        PRIMARY KEY (deliverable_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    const [brandUser] = await testConnection.execute<ResultSetHeader>(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ('test.brand', 'brand@collab-test.local', 'not-used', 'Brand')`,
    );
    const [creatorUser] = await testConnection.execute<ResultSetHeader>(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ('test.creator', 'creator@collab-test.local', 'not-used', 'Creator')`,
    );
    const [creatorTwoUser] = await testConnection.execute<ResultSetHeader>(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ('test.creator.two', 'creator2@collab-test.local', 'not-used', 'Creator')`,
    );
    const [otherBrandUser] = await testConnection.execute<ResultSetHeader>(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ('test.brand.two', 'brand2@collab-test.local', 'not-used', 'Brand')`,
    );

    const [brand] = await testConnection.execute<ResultSetHeader>(
      `INSERT INTO brands (user_id, brand_name, industry, city)
       VALUES (?, 'Test Brand Studio', 'Fashion', 'Bengaluru')`,
      [brandUser.insertId],
    );
    const [otherBrand] = await testConnection.execute<ResultSetHeader>(
      `INSERT INTO brands (user_id, brand_name, industry, city)
       VALUES (?, 'Other Brand Studio', 'Tech', 'Mumbai')`,
      [otherBrandUser.insertId],
    );
    const [creator] = await testConnection.execute<ResultSetHeader>(
      `INSERT INTO creators (user_id, first_name, last_name, city)
       VALUES (?, 'Test', 'Creator', 'Bengaluru')`,
      [creatorUser.insertId],
    );
    const [creatorTwo] = await testConnection.execute<ResultSetHeader>(
      `INSERT INTO creators (user_id, first_name, last_name, city)
       VALUES (?, 'Second', 'Creator', 'Mumbai')`,
      [creatorTwoUser.insertId],
    );

    async function insertCampaign(input: {
      brandId: number;
      name: string;
      status: "Open" | "Ongoing" | "Completed";
      budget: string;
    }): Promise<number> {
      assert.ok(testConnection);
      const [result] = await testConnection.execute<ResultSetHeader>(
        `INSERT INTO campaigns
           (brand_id, campaign_name, description, budget, start_date,
            end_date, status, creator_limit)
         VALUES (?, ?, 'Integration test campaign', ?, '2026-06-01',
                 '2026-06-30', ?, 5)`,
        [input.brandId, input.name, input.budget, input.status],
      );
      return result.insertId;
    }

    const campaignOne = await insertCampaign({
      brandId: brand.insertId,
      name: "Summer Reel Campaign",
      status: "Open",
      budget: "1500.00",
    });
    const campaignTwo = await insertCampaign({
      brandId: brand.insertId,
      name: "Autumn Launch",
      status: "Ongoing",
      budget: "2200.00",
    });
    const campaignThree = await insertCampaign({
      brandId: brand.insertId,
      name: "Winter Campaign",
      status: "Open",
      budget: "800.00",
    });
    const otherCampaign = await insertCampaign({
      brandId: otherBrand.insertId,
      name: "Other Brand Campaign",
      status: "Open",
      budget: "999.00",
    });
    const completedCampaign = await insertCampaign({
      brandId: brand.insertId,
      name: "Finished Campaign",
      status: "Completed",
      budget: "500.00",
    });

    const appPort = await getFreePort();
    const baseUrl = `http://127.0.0.1:${appPort}`;

    server = spawn(
      process.execPath,
      [
        path.join("node_modules", "next", "dist", "bin", "next"),
        "start",
        "-p",
        String(appPort),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "production",
          DB_NAME: testDatabase,
          AUTH_SECRET: authSecret,
          AUTH_SESSION_TTL_SECONDS: "3600",
          MONGODB_URI: mongoUri,
          MONGODB_DB_NAME: mongoUri ? testMongoDatabase : "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    server.stdout?.on("data", (chunk) => {
      serverLogs += chunk.toString();
    });
    server.stderr?.on("data", (chunk) => {
      serverLogs += chunk.toString();
    });

    await waitForServer(baseUrl, server, () => serverLogs);

    const brandCookie = await sessionCookie(
      authSecret,
      brandUser.insertId,
      "test.brand",
      "Brand",
    );
    const creatorCookie = await sessionCookie(
      authSecret,
      creatorUser.insertId,
      "test.creator",
      "Creator",
    );
    const creatorTwoCookie = await sessionCookie(
      authSecret,
      creatorTwoUser.insertId,
      "test.creator.two",
      "Creator",
    );
    const otherBrandCookie = await sessionCookie(
      authSecret,
      otherBrandUser.insertId,
      "test.brand.two",
      "Brand",
    );

    async function http(
      pathname: string,
      options: {
        method?: string;
        json?: unknown;
        cookie?: string | null;
      } = {},
    ): Promise<Response> {
      const headers = new Headers();

      if (options.cookie) {
        headers.set("cookie", options.cookie);
      }

      if (options.json !== undefined) {
        headers.set("content-type", "application/json");
      }

      return fetch(`${baseUrl}${pathname}`, {
        method: options.method ?? "GET",
        headers,
        body:
          options.json === undefined ? undefined : JSON.stringify(options.json),
        redirect: "manual",
      });
    }

    async function json(response: Response): Promise<Record<string, unknown>> {
      return (await response.json()) as Record<string, unknown>;
    }

    async function test(name: string, run: () => Promise<void>): Promise<void> {
      try {
        await run();
      } catch (error) {
        console.error(`\nServer logs for failed test "${name}":\n${serverLogs.slice(-4000)}`);
        throw error;
      }
      passed += 1;
      console.log(`[PASS] ${passed}. ${name}`);
    }

    const baseRequest = {
      title: "Summer Reel collaboration",
      description: "Create a short-form reel for the summer collection.",
      deliverableDescription:
        "One 30-second vertical reel and three story frames.",
      additionalRequirements: "Publish by 10 June and keep usage rights for 90 days.",
      agreedAmount: "1500",
      startDate: "2026-06-01",
      endDate: "2026-06-15",
      campaignId: campaignOne,
      brandId: brand.insertId,
      creatorId: null,
    };

    let requestOneId = 0;
    let requestOneApplicationId = 0;

    await test("unauthenticated collaboration request access is rejected", async () => {
      const response = await http("/api/collaboration-requests");
      assert.equal(response.status, 401);
    });

    await test("creator can propose a collaboration on an open campaign", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: creatorCookie,
        json: baseRequest,
      });

      assert.equal(response.status, 201);
      const payload = await json(response);
      const request = (payload.data as Record<string, unknown>)
        .request as Record<string, unknown>;

      requestOneId = Number(request.collaborationId);
      assert.ok(requestOneId > 0);
      assert.equal(request.status, "Pending");
      assert.equal(request.requestedBy, "Creator");
      assert.equal(request.title, baseRequest.title);

      assert.ok(testConnection);
      const [rows] = await testConnection.execute<RowDataPacket[]>(
        `SELECT co.status, co.requested_by, co.title,
                co.agreed_amount, a.application_id, a.status AS application_status
         FROM collaborations co
         INNER JOIN applications a ON a.application_id = co.application_id
         WHERE co.collaboration_id = ?`,
        [requestOneId],
      );

      assert.equal(rows.length, 1);
      requestOneApplicationId = rows[0].application_id;
      assert.equal(rows[0].status, "Pending");
      assert.equal(rows[0].application_status, "Pending");
      assert.equal(rows[0].requested_by, "Creator");
      assert.equal(rows[0].title, baseRequest.title);
      assert.equal(rows[0].agreed_amount, "1500.00");
    });

    if (mongoDb) {
      await test("creator proposal creates a MongoDB recipient notification and activity log", async () => {
        const notification = await mongoDb
          .collection("notifications")
          .findOne({ dedupeKey: `collaboration-request:${requestOneId}:created` });
        const activity = await mongoDb
          .collection("activity_logs")
          .findOne({
            dedupeKey: `collaboration-request:${requestOneId}:created-activity`,
          });

        assert.equal(notification?.userId, brandUser.insertId);
        assert.equal(notification?.userRole, "Brand");
        assert.equal(notification?.type, "collaboration_request");
        assert.equal(notification?.relatedEntityId, requestOneId);
        assert.equal(activity?.actorId, creatorUser.insertId);
        assert.equal(activity?.action, "collaboration_request_created");
        assert.equal(activity?.entityId, requestOneId);
      });
    }

    await test("pending requests stay out of normal collaboration lists", async () => {
      const brandResponse = await http("/api/brand/collaborations", {
        cookie: brandCookie,
      });
      const creatorResponse = await http(
        `/api/creator/collaborations?status=all&page=1&pageSize=6`,
        { cookie: creatorCookie },
      );

      assert.equal(brandResponse.status, 200);
      assert.equal(creatorResponse.status, 200);

      const brandPayload = await json(brandResponse);
      const creatorPayload = await json(creatorResponse);
      const brandData = brandPayload.data as Record<string, unknown>;
      const creatorData = creatorPayload.data as Record<string, unknown>;

      assert.equal(
        (brandData.collaborations as Array<Record<string, unknown>>).length,
        0,
      );
      assert.equal(
        (creatorData.collaborations as Array<Record<string, unknown>>).length,
        0,
      );
    });

    await test("normal update endpoint cannot activate a pending request", async () => {
      const response = await http(`/api/collaborations/${requestOneId}`, {
        method: "PATCH",
        cookie: brandCookie,
        json: { status: "Active" },
      });

      assert.equal(response.status, 409);
      const payload = await json(response);
      assert.equal(
        (payload.error as Record<string, unknown>).code,
        "INVALID_STATUS_TRANSITION",
      );
    });

    await test("creator sees the sent request and brand sees it as incoming", async () => {
      const creatorResponse = await http("/api/collaboration-requests", {
        cookie: creatorCookie,
      });
      const brandResponse = await http("/api/collaboration-requests", {
        cookie: brandCookie,
      });

      assert.equal(creatorResponse.status, 200);
      assert.equal(brandResponse.status, 200);

      const creatorData = (await json(creatorResponse)).data as Record<
        string,
        unknown
      >;
      const brandData = (await json(brandResponse)).data as Record<
        string,
        unknown
      >;

      const creatorOutgoing = creatorData.outgoing as Array<
        Record<string, unknown>
      >;
      const creatorIncoming = creatorData.incoming as Array<
        Record<string, unknown>
      >;
      const brandIncoming = brandData.incoming as Array<Record<string, unknown>>;

      assert.equal(creatorOutgoing.length, 1);
      assert.equal(creatorOutgoing[0].collaborationId, requestOneId);
      assert.equal(creatorIncoming.length, 0);
      assert.equal(brandIncoming.length, 1);
      assert.equal(brandIncoming[0].collaborationId, requestOneId);

      const options = creatorData.options as Record<string, unknown>;
      assert.ok((options.campaigns as unknown[]).length >= 3);
    });

    await test("duplicate campaign and creator requests are rejected", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: creatorCookie,
        json: { ...baseRequest, title: "Duplicate request" },
      });

      assert.equal(response.status, 409);
      const payload = await json(response);
      assert.equal(
        (payload.error as Record<string, unknown>).code,
        "REQUEST_DUPLICATE",
      );

      assert.ok(testConnection);
      const [rows] = await testConnection.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS count
         FROM applications WHERE campaign_id = ? AND creator_id = ?`,
        [campaignOne, creator.insertId],
      );
      assert.equal(rows[0].count, 1);
    });

    await test("invalid request input is rejected", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: creatorCookie,
        json: {
          ...baseRequest,
          campaignId: campaignThree,
          startDate: "2026-07-20",
          endDate: "2026-07-01",
        },
      });

      assert.equal(response.status, 400);
      const payload = await json(response);
      assert.equal(
        (payload.error as Record<string, unknown>).code,
        "VALIDATION_ERROR",
      );
    });

    await test("completed campaigns cannot receive requests", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: creatorCookie,
        json: { ...baseRequest, campaignId: completedCampaign },
      });

      assert.equal(response.status, 409);
      const payload = await json(response);
      assert.equal(
        (payload.error as Record<string, unknown>).code,
        "REQUEST_CAMPAIGN_CLOSED",
      );
    });

    await test("only the recipient can decide a request", async () => {
      const creatorResponse = await http(
        `/api/collaboration-requests/${requestOneId}/accept`,
        {
          method: "POST",
          cookie: creatorCookie,
          json: {},
        },
      );
      const otherCreatorResponse = await http(
        `/api/collaboration-requests/${requestOneId}/accept`,
        {
          method: "POST",
          cookie: creatorTwoCookie,
          json: {},
        },
      );

      assert.equal(creatorResponse.status, 403);
      assert.equal(otherCreatorResponse.status, 403);
    });

    await test("brand acceptance activates both records", async () => {
      const response = await http(
        `/api/collaboration-requests/${requestOneId}/accept`,
        {
          method: "POST",
          cookie: brandCookie,
          json: {},
        },
      );

      assert.equal(response.status, 200);
      const payload = await json(response);
      const request = (payload.data as Record<string, unknown>)
        .request as Record<string, unknown>;
      assert.equal(request.status, "Active");

      assert.ok(testConnection);
      const [rows] = await testConnection.execute<RowDataPacket[]>(
        `SELECT co.status, co.decided_at, a.status AS application_status
         FROM collaborations co
         INNER JOIN applications a ON a.application_id = co.application_id
         WHERE co.collaboration_id = ?`,
        [requestOneId],
      );

      assert.equal(rows[0].status, "Active");
      assert.equal(rows[0].application_status, "Accepted");
      assert.ok(rows[0].decided_at);
    });

    if (mongoDb) {
      await test("acceptance notifies the original creator and records brand activity", async () => {
        const notification = await mongoDb
          .collection("notifications")
          .findOne({
            dedupeKey: `collaboration-request:${requestOneId}:accepted`,
          });
        const activity = await mongoDb
          .collection("activity_logs")
          .findOne({
            dedupeKey: `collaboration-request:${requestOneId}:accepted-activity`,
          });

        assert.equal(notification?.userId, creatorUser.insertId);
        assert.equal(notification?.userRole, "Creator");
        assert.equal(notification?.type, "collaboration_request_accepted");
        assert.equal(activity?.actorId, brandUser.insertId);
        assert.equal(activity?.action, "collaboration_request_accepted");
      });
    }

    await test("decided requests cannot be accepted twice", async () => {
      const response = await http(
        `/api/collaboration-requests/${requestOneId}/accept`,
        {
          method: "POST",
          cookie: brandCookie,
          json: {},
        },
      );

      assert.equal(response.status, 409);
      const payload = await json(response);
      assert.equal(
        (payload.error as Record<string, unknown>).code,
        "REQUEST_ALREADY_DECIDED",
      );
    });

    await test("accepted request appears in active collaboration lists", async () => {
      const brandResponse = await http("/api/brand/collaborations", {
        cookie: brandCookie,
      });
      const creatorResponse = await http(
        "/api/creator/collaborations?status=Active&page=1&pageSize=6",
        { cookie: creatorCookie },
      );

      assert.equal(brandResponse.status, 200);
      assert.equal(creatorResponse.status, 200);

      const brandData = (await json(brandResponse)).data as Record<
        string,
        unknown
      >;
      const creatorData = (await json(creatorResponse)).data as Record<
        string,
        unknown
      >;
      const brandCollaborations = brandData.collaborations as Array<
        Record<string, unknown>
      >;
      const creatorCollaborations = creatorData.collaborations as Array<
        Record<string, unknown>
      >;

      assert.ok(
        brandCollaborations.some(
          (item) => item.collaborationId === requestOneId,
        ),
      );
      assert.ok(
        creatorCollaborations.some(
          (item) => item.collaborationId === requestOneId,
        ),
      );
      assert.equal(
        brandCollaborations.find(
          (item) => item.collaborationId === requestOneId,
        )?.title,
        baseRequest.title,
      );
    });

    await test("request-backed applications stay out of application lists", async () => {
      const creatorResponse = await http(
        "/api/creator/applications?status=all&page=1&pageSize=6",
        { cookie: creatorCookie },
      );
      const brandResponse = await http("/api/brand/applications", {
        cookie: brandCookie,
      });

      assert.equal(creatorResponse.status, 200);
      assert.equal(brandResponse.status, 200);

      const creatorData = (await json(creatorResponse)).data as Record<
        string,
        unknown
      >;
      const brandPayload = await json(brandResponse);
      const brandData = brandPayload.data as Record<string, unknown>;
      const creatorApplications = creatorData.applications as Array<
        Record<string, unknown>
      >;
      const brandApplications = brandData.applications as Array<
        Record<string, unknown>
      >;

      assert.ok(
        !creatorApplications.some(
          (item) => item.applicationId === requestOneApplicationId,
        ),
      );
      assert.ok(
        !brandApplications.some(
          (item) => item.applicationId === requestOneApplicationId,
        ),
      );
    });

    let brandInviteId = 0;

    await test("brand can invite a creator to an owned campaign", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: brandCookie,
        json: {
          ...baseRequest,
          title: "Autumn launch invitation",
          campaignId: campaignTwo,
          creatorId: creatorTwo.insertId,
        },
      });

      assert.equal(response.status, 201);
      const payload = await json(response);
      const request = (payload.data as Record<string, unknown>)
        .request as Record<string, unknown>;
      brandInviteId = Number(request.collaborationId);
      assert.equal(request.requestedBy, "Brand");
      assert.equal(request.status, "Pending");
    });

    await test("a brand cannot decide its own outgoing invitation", async () => {
      const response = await http(
        `/api/collaboration-requests/${brandInviteId}/accept`,
        {
          method: "POST",
          cookie: brandCookie,
          json: {},
        },
      );

      assert.equal(response.status, 403);
    });

    await test("creator receives and accepts a brand invitation", async () => {
      const inboxResponse = await http("/api/collaboration-requests", {
        cookie: creatorTwoCookie,
      });
      assert.equal(inboxResponse.status, 200);
      const inboxData = (await json(inboxResponse)).data as Record<
        string,
        unknown
      >;
      const incoming = inboxData.incoming as Array<Record<string, unknown>>;
      assert.ok(
        incoming.some((item) => item.collaborationId === brandInviteId),
      );

      const response = await http(
        `/api/collaboration-requests/${brandInviteId}/accept`,
        {
          method: "POST",
          cookie: creatorTwoCookie,
          json: {},
        },
      );
      assert.equal(response.status, 200);
    });

    await test("brand cannot invite a creator to another brand's campaign", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: otherBrandCookie,
        json: {
          ...baseRequest,
          title: "Cross-brand invitation",
          campaignId: campaignThree,
          creatorId: creator.insertId,
        },
      });

      assert.equal(response.status, 403);
    });

    await test("brand can invite a creator on another brand's campaign only as itself", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: otherBrandCookie,
        json: {
          ...baseRequest,
          title: "Cross-brand campaign invitation",
          campaignId: otherCampaign,
          creatorId: creator.insertId,
        },
      });

      assert.equal(response.status, 201);
    });

    let rejectedRequestId = 0;

    await test("recipient can reject a request and both records are updated", async () => {
      const createResponse = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: brandCookie,
        json: {
          ...baseRequest,
          title: "Winter campaign invitation",
          campaignId: campaignThree,
          creatorId: creator.insertId,
        },
      });
      assert.equal(createResponse.status, 201);
      const createPayload = await json(createResponse);
      rejectedRequestId = Number(
        (
          (createPayload.data as Record<string, unknown>).request as Record<
            string,
            unknown
          >
        ).collaborationId,
      );

      const response = await http(
        `/api/collaboration-requests/${rejectedRequestId}/reject`,
        {
          method: "POST",
          cookie: creatorCookie,
          json: {},
        },
      );
      assert.equal(response.status, 200);

      assert.ok(testConnection);
      const [rows] = await testConnection.execute<RowDataPacket[]>(
        `SELECT co.status, co.decided_at, a.status AS application_status
         FROM collaborations co
         INNER JOIN applications a ON a.application_id = co.application_id
         WHERE co.collaboration_id = ?`,
        [rejectedRequestId],
      );
      assert.equal(rows[0].status, "Rejected");
      assert.equal(rows[0].application_status, "Rejected");
      assert.ok(rows[0].decided_at);
    });

    if (mongoDb) {
      await test("rejection notifies the original brand and records creator activity", async () => {
        const notification = await mongoDb
          .collection("notifications")
          .findOne({
            dedupeKey: `collaboration-request:${rejectedRequestId}:rejected`,
          });
        const activity = await mongoDb
          .collection("activity_logs")
          .findOne({
            dedupeKey: `collaboration-request:${rejectedRequestId}:rejected-activity`,
          });

        assert.equal(notification?.userId, brandUser.insertId);
        assert.equal(notification?.userRole, "Brand");
        assert.equal(notification?.type, "collaboration_request_rejected");
        assert.equal(activity?.actorId, creatorUser.insertId);
        assert.equal(activity?.action, "collaboration_request_rejected");
      });
    }

    await test("rejected requests drop out of incoming lists", async () => {
      const inboxResponse = await http("/api/collaboration-requests", {
        cookie: creatorCookie,
      });
      const brandInboxResponse = await http("/api/collaboration-requests", {
        cookie: brandCookie,
      });
      const inboxData = (await json(inboxResponse)).data as Record<
        string,
        unknown
      >;
      const brandInboxData = (await json(brandInboxResponse)).data as Record<
        string,
        unknown
      >;
      const incoming = inboxData.incoming as Array<Record<string, unknown>>;
      const outgoing = brandInboxData.outgoing as Array<Record<string, unknown>>;

      assert.ok(
        !incoming.some((item) => item.collaborationId === rejectedRequestId),
      );
      assert.equal(
        outgoing.find(
          (item) => item.collaborationId === rejectedRequestId,
        )?.status,
        "Rejected",
      );
    });

    await test("invalid collaboration IDs return a validation error", async () => {
      const response = await http(
        "/api/collaboration-requests/not-a-number/accept",
        {
          method: "POST",
          cookie: brandCookie,
          json: {},
        },
      );

      assert.equal(response.status, 400);
    });

    await test("creator options include registered brands list", async () => {
      const response = await http("/api/collaboration-requests", {
        cookie: creatorCookie,
      });
      assert.equal(response.status, 200);
      const payload = await json(response);
      const options = (payload.data as Record<string, unknown>).options as Record<
        string,
        unknown
      >;
      const brands = options.brands as Array<Record<string, unknown>>;
      assert.ok(Array.isArray(brands));
      assert.ok(brands.length >= 2);
      assert.ok(brands.some((b) => b.brandName === "Test Brand Studio"));
    });

    let creatorDirectProposalId = 0;

    await test("creator can propose collaboration directly to brand by brandId", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: creatorTwoCookie,
        json: {
          title: "Direct Creator Proposal to Other Brand",
          description: "Let us work together directly on tech showcase content.",
          deliverableDescription: "2 dedicated short videos and product testing post.",
          additionalRequirements: "30 days exclusivity in category.",
          agreedAmount: "2500.00",
          startDate: "2026-07-01",
          endDate: "2026-07-20",
          campaignId: otherCampaign,
          brandId: otherBrand.insertId,
          creatorId: null,
        },
      });

      assert.equal(response.status, 201);
      const payload = await json(response);
      const request = (payload.data as Record<string, unknown>)
        .request as Record<string, unknown>;
      creatorDirectProposalId = Number(request.collaborationId);
      assert.ok(creatorDirectProposalId > 0);
      assert.equal(request.status, "Pending");
      assert.equal(request.requestedBy, "Creator");
      assert.equal(request.brandId, otherBrand.insertId);
    });

    await test("brand request must reference an existing campaign", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: otherBrandCookie,
        json: {
          title: "Direct Brand Outreach to Creator Two",
          description: "We love your content and want to sponsor your next tech video.",
          deliverableDescription: "1 integrated sponsorship segment.",
          additionalRequirements: "Link in description for 60 days.",
          agreedAmount: "1800.00",
          startDate: "2026-07-05",
          endDate: "2026-07-25",
          creatorId: creatorTwo.insertId,
        },
      });

      assert.equal(response.status, 400);
      const payload = await json(response);
      assert.equal(
        (payload.error as Record<string, unknown>).code,
        "VALIDATION_ERROR",
      );
      assert.ok(
        "campaignId" in
          ((payload.error as Record<string, unknown>).fields as Record<
            string,
            unknown
          >),
      );
    });

    await test("duplicate direct invitation to the same creator on the campaign is rejected", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: otherBrandCookie,
        json: {
          title: "Duplicate Brand Outreach to Creator",
          deliverableDescription: "1 integrated sponsorship segment.",
          agreedAmount: "1800.00",
          startDate: "2026-07-05",
          endDate: "2026-07-25",
          campaignId: otherCampaign,
          creatorId: creator.insertId,
        },
      });

      assert.equal(response.status, 409);
      const payload = await json(response);
      assert.equal(
        (payload.error as Record<string, unknown>).code,
        "REQUEST_DUPLICATE",
      );
    });

    await test("proposing collaboration to invalid brand ID returns 404", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: creatorCookie,
        json: {
          title: "Proposal to Nonexistent Brand",
          deliverableDescription: "1 video showcase and 2 social stories.",
          agreedAmount: "1000.00",
          startDate: "2026-08-01",
          endDate: "2026-08-15",
          campaignId: campaignOne,
          brandId: 999999,
          creatorId: null,
        },
      });

      assert.equal(response.status, 404);
      const payload = await json(response);
      assert.equal(
        (payload.error as Record<string, unknown>).code,
        "REQUEST_BRAND_NOT_FOUND",
      );
    });

    await test("inviting invalid creator ID returns 404", async () => {
      const response = await http("/api/collaboration-requests", {
        method: "POST",
        cookie: brandCookie,
        json: {
          title: "Invitation to Nonexistent Creator",
          deliverableDescription: "1 video showcase and 2 social stories.",
          agreedAmount: "1000.00",
          startDate: "2026-08-01",
          endDate: "2026-08-15",
          campaignId: campaignOne,
          creatorId: 999999,
        },
      });

      assert.equal(response.status, 404);
      const payload = await json(response);
      assert.equal(
        (payload.error as Record<string, unknown>).code,
        "REQUEST_CREATOR_NOT_FOUND",
      );
    });

    await test("unrelated user cannot accept direct proposal", async () => {
      const response = await http(
        `/api/collaboration-requests/${creatorDirectProposalId}/accept`,
        {
          method: "POST",
          cookie: brandCookie, // Not the otherBrand recipient!
          json: {},
        },
      );

      assert.equal(response.status, 403);
    });

    console.log(
      `\nCOLLABORATION TEST SUMMARY: ${passed} passed, 0 failed (database ${testDatabase}).`,
    );
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await delay(300);
    }

    if (testConnection) {
      await testConnection.end();
    }

    if (testDatabase.startsWith("creatorconnect_collab_test_")) {
      await adminConnection.query(`DROP DATABASE IF EXISTS \`${testDatabase}\``);
    }

    await adminConnection.end();
    if (mongoClient) {
      try {
        if (mongoConnected) {
          await mongoClient.db(testMongoDatabase).dropDatabase();
        }
      } finally {
        await mongoClient.close();
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    `COLLABORATION TEST FAILED: ${
      error instanceof Error ? error.message : "Unknown error"
    }`,
  );
  process.exitCode = 1;
});
