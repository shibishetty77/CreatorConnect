import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";

import { SignJWT } from "jose";
import mysql, {
  type Connection,
  type RowDataPacket,
} from "mysql2/promise";

const LIVE_TABLE_COUNT = 15;

const CREATOR = { userId: 2, username: "ananya.rao", role: "Creator" as const };
const OTHER_CREATOR = {
  userId: 3,
  username: "rohan.mehta",
  role: "Creator" as const,
};
const BRAND = { userId: 10, username: "brand.novathread", role: "Brand" as const };
const ADMIN = { userId: 1, username: "admin_creatorconnect", role: "Admin" as const };

const BASE_TABLES = [
  "users",
  "creators",
  "creator_social_accounts",
  "brands",
  "campaign_categories",
  "campaigns",
  "campaign_requirements",
  "applications",
  "collaborations",
  "deliverables",
  "content_submissions",
  "contracts",
  "payments",
  "performance_metrics",
  "reviews",
];

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readMetric(html: string, metricKey: string): string {
  const pattern = new RegExp(
    `data-metric="${escapeRegExp(metricKey)}"[^>]*data-value="([^"]*)"`,
  );
  const match = html.match(pattern);

  assert.ok(match, `Expected dashboard metric "${metricKey}" in the response.`);

  return match[1];
}

function assertMetric(
  html: string,
  metricKey: string,
  expected: number | string,
): void {
  assert.equal(
    readMetric(html, metricKey),
    String(expected),
    `Metric "${metricKey}" did not match the database value.`,
  );
}

async function waitForServer(
  baseUrl: string,
  child: ChildProcess,
  getLogs: () => string,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
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

function signSession(
  user: { userId: number; username: string; role: "Creator" | "Brand" | "Admin" },
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.userId))
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(secret));
}

function parseStatusRows(rows: RowDataPacket[]): Record<string, number> {
  const result: Record<string, number> = {};

  for (const row of rows) {
    result[String(row.status)] = Number(row.count);
  }

  return result;
}

async function main(): Promise<void> {
  const host = requireEnv("DB_HOST");
  const port = Number(requireEnv("DB_PORT"));
  const user = requireEnv("DB_USER");
  const password = requireEnv("DB_PASSWORD");
  const liveDatabase = requireEnv("DB_NAME");
  const authSecret = requireEnv("AUTH_SECRET");

  assert.ok(
    authSecret.length >= 32,
    "AUTH_SECRET must be at least 32 characters for the test run.",
  );

  const suffix = `${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const testDatabase = `creatorconnect_phase4_test_${suffix}`;

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

  try {
    const [liveTables] = await adminConnection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [liveDatabase],
    );

    assert.equal(
      liveTables.length,
      LIVE_TABLE_COUNT,
      "The live database does not expose the expected 15 base tables.",
    );

    let liveTotal = 0;
    const liveCounts = new Map<string, number>();

    for (const table of BASE_TABLES) {
      const [rows] = await adminConnection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM \`${liveDatabase}\`.\`${table}\``,
      );
      const count = Number(rows[0].count);
      liveTotal += count;
      liveCounts.set(table, count);
    }

    await adminConnection.query(
      `CREATE DATABASE \`${testDatabase}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );

    for (const table of BASE_TABLES) {
      await adminConnection.query(
        `CREATE TABLE \`${testDatabase}\`.\`${table}\`
         LIKE \`${liveDatabase}\`.\`${table}\``,
      );
      await adminConnection.query(
        `INSERT INTO \`${testDatabase}\`.\`${table}\`
         SELECT * FROM \`${liveDatabase}\`.\`${table}\``,
      );
    }

    testConnection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database: testDatabase,
    });

    const [copiedTables] = await testConnection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [testDatabase],
    );

    assert.equal(copiedTables.length, LIVE_TABLE_COUNT);

    let copiedTotal = 0;

    for (const table of BASE_TABLES) {
      const [rows] = await testConnection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM \`${table}\``,
      );
      copiedTotal += Number(rows[0].count);
    }

    assert.equal(copiedTotal, liveTotal);

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

    async function http(
      pathname: string,
      options: {
        method?: string;
        json?: unknown;
        cookie?: string | null;
        redirect?: RequestRedirect;
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
        redirect: options.redirect ?? "manual",
      });
    }

    async function json(response: Response): Promise<Record<string, unknown>> {
      return (await response.json()) as Record<string, unknown>;
    }

    async function test(name: string, run: () => Promise<void>): Promise<void> {
      await run();
      passed += 1;
      console.log(`[PASS] ${passed}. ${name}`);
    }

    const creatorCookie = `cc_session=${await signSession(CREATOR, authSecret)}`;
    const otherCreatorCookie = `cc_session=${await signSession(
      OTHER_CREATOR,
      authSecret,
    )}`;
    const brandCookie = `cc_session=${await signSession(BRAND, authSecret)}`;
    const adminCookie = `cc_session=${await signSession(ADMIN, authSecret)}`;

    const [openCampaignRows] = await testConnection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM campaigns
       WHERE status = 'Open'
         AND start_date <= CURRENT_DATE()
         AND end_date >= CURRENT_DATE()`,
    );
    const [creatorAppRows] = await testConnection.query<RowDataPacket[]>(
      "SELECT status, COUNT(*) AS count FROM applications WHERE creator_id = 1 GROUP BY status",
    );
    const [creatorCollaborationRows] =
      await testConnection.query<RowDataPacket[]>(
        `SELECT co.status, COUNT(*) AS count
         FROM collaborations co
         INNER JOIN applications a ON a.application_id = co.application_id
         WHERE a.creator_id = 1
         GROUP BY co.status`,
      );
    const [creatorDeliverableRows] =
      await testConnection.query<RowDataPacket[]>(
        `SELECT d.status, COUNT(*) AS count
         FROM deliverables d
         INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
         INNER JOIN applications a ON a.application_id = co.application_id
         WHERE a.creator_id = 1
         GROUP BY d.status`,
      );
    const [creatorPaidRows] = await testConnection.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
       INNER JOIN applications a ON a.application_id = co.application_id
       WHERE a.creator_id = 1 AND p.status = 'Paid'`,
    );

    const [brandCampaignRows] = await testConnection.query<RowDataPacket[]>(
      "SELECT status, COUNT(*) AS count FROM campaigns WHERE brand_id = 1 GROUP BY status",
    );
    const [brandBudgetRows] = await testConnection.query<RowDataPacket[]>(
      "SELECT COALESCE(SUM(budget), 0) AS total FROM campaigns WHERE brand_id = 1",
    );
    const [brandApplicationRows] =
      await testConnection.query<RowDataPacket[]>(
        `SELECT a.status, COUNT(*) AS count
         FROM applications a
         INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
         WHERE ca.brand_id = 1
         GROUP BY a.status`,
      );
    const [brandCollaborationRows] =
      await testConnection.query<RowDataPacket[]>(
        `SELECT co.status, COUNT(*) AS count
         FROM collaborations co
         INNER JOIN applications a ON a.application_id = co.application_id
         INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
         WHERE ca.brand_id = 1
         GROUP BY co.status`,
      );

    const [adminCountRows] = await testConnection.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM creators) AS creators,
         (SELECT COUNT(*) FROM brands) AS brands,
         (SELECT COUNT(*) FROM campaigns) AS campaigns,
         (SELECT COUNT(*) FROM collaborations) AS collaborations,
         (SELECT COUNT(*) FROM collaborations WHERE status = 'Completed') AS completed_collaborations,
         (SELECT COUNT(*) FROM payments) AS payments,
         (SELECT COUNT(*) FROM applications) AS applications,
         (SELECT COUNT(*) FROM content_submissions) AS submissions,
         (SELECT COUNT(*) FROM reviews) AS reviews`,
    );

    const creatorApps = parseStatusRows(creatorAppRows);
    const creatorCollaborations = parseStatusRows(creatorCollaborationRows);
    const creatorDeliverables = parseStatusRows(creatorDeliverableRows);
    const brandCampaigns = parseStatusRows(brandCampaignRows);
    const brandApplications = parseStatusRows(brandApplicationRows);
    const brandCollaborations = parseStatusRows(brandCollaborationRows);
    const metrics = adminCountRows[0];

    await test("seeded live database remains untouched and complete", async () => {
      let total = 0;

      for (const table of BASE_TABLES) {
        const [rows] = await adminConnection.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS count FROM \`${liveDatabase}\`.\`${table}\``,
        );
        const count = Number(rows[0].count);
        assert.equal(
          count,
          liveCounts.get(table),
          `Live table ${table} changed during the test run.`,
        );
        total += count;
      }

      assert.equal(total, liveTotal);
    });

    await test("unauthenticated dashboard and profile requests are blocked", async () => {
      for (const pathname of [
        "/creator/dashboard",
        "/brand/dashboard",
        "/admin/dashboard",
      ]) {
        const response = await http(pathname);
        assert.equal(response.status, 307);
        assert.match(response.headers.get("location") ?? "", /\/login\?next=/);
      }

      const apiResponse = await http("/api/creator/profile");
      assert.equal(apiResponse.status, 401);
    });

    await test("creator dashboard only shows the authenticated creator data", async () => {
      const response = await http("/creator/dashboard", {
        cookie: creatorCookie,
      });
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(html, /Welcome back, Ananya\./);
      assert.match(html, /ananya\.rao@creatorconnect\.local/);
      assert.doesNotMatch(html, /rohan\.mehta@creatorconnect\.local/);
      assert.match(html, /Discover Campaigns/);
      assert.match(html, /My Applications/);
      assert.match(html, /My Profile/);

      assertMetric(html, "creator.open-campaigns", Number(openCampaignRows[0].count));
      assertMetric(
        html,
        "creator.applications.total",
        Object.values(creatorApps).reduce((sum, value) => sum + value, 0),
      );
      assertMetric(
        html,
        "creator.applications.accepted",
        creatorApps.Accepted ?? 0,
      );
      assertMetric(
        html,
        "creator.applications.rejected",
        creatorApps.Rejected ?? 0,
      );
      assertMetric(
        html,
        "creator.collaborations.active",
        creatorCollaborations.Active ?? 0,
      );
      assertMetric(
        html,
        "creator.collaborations.completed",
        creatorCollaborations.Completed ?? 0,
      );
      assertMetric(
        html,
        "creator.deliverables.pending",
        (creatorDeliverables.Pending ?? 0) + (creatorDeliverables.Submitted ?? 0),
      );
      assertMetric(
        html,
        "creator.payments.paid",
        String(creatorPaidRows[0].total),
      );
      assert.match(html, /Social reach/);
      assert.match(html, /Payment summary/);
      assert.match(html, /Recent activity/);
    });

    await test("creator profile loads and updates only the session profile", async () => {
      const pageResponse = await http("/creator/profile", {
        cookie: creatorCookie,
      });
      const pageHtml = await pageResponse.text();

      assert.equal(pageResponse.status, 200);
      assert.match(pageHtml, /ananya\.rao@creatorconnect\.local/);
      assert.match(pageHtml, /Social accounts/);

      const apiResponse = await http("/api/creator/profile", {
        cookie: creatorCookie,
      });
      const apiBody = await json(apiResponse);
      const profile = (apiBody.data as Record<string, unknown>)
        .profile as Record<string, unknown>;

      assert.equal(apiResponse.status, 200);
      assert.equal(profile.creatorId, 1);
      assert.equal(profile.email, "ananya.rao@creatorconnect.local");
      assert.doesNotMatch(JSON.stringify(apiBody), /password/i);

      const updateResponse = await http("/api/creator/profile", {
        method: "PATCH",
        cookie: creatorCookie,
        json: {
          creatorId: 2,
          firstName: "Ananya",
          lastName: "Rao Phase4",
          dateOfBirth: "1995-04-12",
          phone: "9876500011",
          bio: "Phase 4 integration test profile update.",
          address: "14 Indiranagar 2nd Stage",
          city: "Bengaluru",
          state: "Karnataka",
          profilePictureUrl: "https://example.com/ananya-phase4.jpg",
        },
      });
      const updateBody = await json(updateResponse);
      const updated = (updateBody.data as Record<string, unknown>)
        .profile as Record<string, unknown>;

      assert.equal(updateResponse.status, 200);
      assert.equal(updated.creatorId, 1);
      assert.equal(updated.lastName, "Rao Phase4");

      assert.ok(testConnection);
      const [rows] = await testConnection.query<RowDataPacket[]>(
        `SELECT creator_id, last_name, phone, bio, profile_picture_url
         FROM creators WHERE creator_id IN (1, 2) ORDER BY creator_id`,
      );

      assert.equal(rows[0].last_name, "Rao Phase4");
      assert.equal(rows[0].phone, "9876500011");
      assert.equal(rows[0].bio, "Phase 4 integration test profile update.");
      assert.equal(
        rows[0].profile_picture_url,
        "https://example.com/ananya-phase4.jpg",
      );
      assert.equal(rows[1].last_name, "Mehta");
    });

    await test("creator profile rejects invalid data and cross-role writes", async () => {
      const invalidCases = [
        {
          firstName: "",
          lastName: "Rao",
          dateOfBirth: "1995-04-12",
          phone: "9876500011",
          bio: "",
          address: "",
          city: "",
          state: "",
          profilePictureUrl: "",
        },
        {
          firstName: "Ananya",
          lastName: "Rao",
          dateOfBirth: "1995-04-12",
          phone: "1234567890123456",
          bio: "",
          address: "",
          city: "",
          state: "",
          profilePictureUrl: "",
        },
        {
          firstName: "Ananya",
          lastName: "Rao",
          dateOfBirth: "1995-04-12",
          phone: "9876500011",
          bio: "",
          address: "",
          city: "",
          state: "",
          profilePictureUrl: "javascript:alert(1)",
        },
      ];

      for (const payload of invalidCases) {
        const response = await http("/api/creator/profile", {
          method: "PATCH",
          cookie: creatorCookie,
          json: payload,
        });

        assert.equal(response.status, 400);
      }

      const brandWrite = await http("/api/creator/profile", {
        method: "PATCH",
        cookie: brandCookie,
        json: {
          firstName: "Ananya",
          lastName: "Rao",
          dateOfBirth: "",
          phone: "",
          bio: "",
          address: "",
          city: "",
          state: "",
          profilePictureUrl: "",
        },
      });
      assert.equal(brandWrite.status, 403);

      const creatorWriteBrand = await http("/api/brand/profile", {
        method: "PATCH",
        cookie: creatorCookie,
        json: {
          brandName: "Hijacked Brand",
          industry: "",
          contactNumber: "",
          address: "",
          city: "",
          state: "",
        },
      });
      assert.equal(creatorWriteBrand.status, 403);
    });

    await test("social account create, edit and delete persist and enforce ownership", async () => {
      const createResponse = await http("/api/creator/social-accounts", {
        method: "POST",
        cookie: creatorCookie,
        json: {
          platform: "YouTube",
          username: "ananya.phase4",
          followers: "125000",
          engagementRate: "3.45",
          accountUrl: "https://youtube.com/@ananya-phase4",
        },
      });
      const createBody = await json(createResponse);
      const account = (createBody.data as Record<string, unknown>)
        .account as Record<string, unknown>;

      assert.equal(createResponse.status, 201);
      assert.equal(account.platform, "YouTube");
      assert.equal(account.followers, 125000);
      assert.equal(account.engagementRate, "3.45");

      const accountId = Number(account.accountId);
      assert.ok(Number.isInteger(accountId) && accountId > 0);

      assert.ok(testConnection);
      const [createdRows] = await testConnection.query<RowDataPacket[]>(
        "SELECT creator_id, platform, username, followers FROM creator_social_accounts WHERE account_id = ?",
        [accountId],
      );
      assert.equal(createdRows.length, 1);
      assert.equal(createdRows[0].creator_id, 1);
      assert.equal(createdRows[0].username, "ananya.phase4");

      const updateResponse = await http(
        `/api/creator/social-accounts/${accountId}`,
        {
          method: "PATCH",
          cookie: creatorCookie,
          json: {
            platform: "YouTube",
            username: "ananya.phase4.updated",
            followers: "200500",
            engagementRate: "4.10",
            accountUrl: "https://youtube.com/@ananya-phase4-updated",
          },
        },
      );
      const updateBody = await json(updateResponse);
      const updated = (updateBody.data as Record<string, unknown>)
        .account as Record<string, unknown>;

      assert.equal(updateResponse.status, 200);
      assert.equal(updated.followers, 200500);
      assert.equal(updated.username, "ananya.phase4.updated");

      const otherUpdate = await http(
        `/api/creator/social-accounts/${accountId}`,
        {
          method: "PATCH",
          cookie: otherCreatorCookie,
          json: {
            platform: "YouTube",
            username: "stolen",
            followers: "1",
            engagementRate: "1",
            accountUrl: "",
          },
        },
      );
      assert.equal(otherUpdate.status, 404);

      const otherDelete = await http(
        `/api/creator/social-accounts/${accountId}`,
        {
          method: "DELETE",
          cookie: otherCreatorCookie,
        },
      );
      assert.equal(otherDelete.status, 404);

      const [stillThere] = await testConnection.query<RowDataPacket[]>(
        "SELECT username FROM creator_social_accounts WHERE account_id = ?",
        [accountId],
      );
      assert.equal(stillThere[0].username, "ananya.phase4.updated");

      const invalidCreate = await http("/api/creator/social-accounts", {
        method: "POST",
        cookie: creatorCookie,
        json: {
          platform: "TikTok",
          username: "ananya.tiktok",
          followers: "-5",
          engagementRate: "101",
          accountUrl: "not-a-url",
        },
      });
      assert.equal(invalidCreate.status, 400);

      const brandCreate = await http("/api/creator/social-accounts", {
        method: "POST",
        cookie: brandCookie,
        json: {
          platform: "Instagram",
          username: "brand.account",
          followers: "10",
          engagementRate: "1",
          accountUrl: "",
        },
      });
      assert.equal(brandCreate.status, 403);

      const deleteResponse = await http(
        `/api/creator/social-accounts/${accountId}`,
        {
          method: "DELETE",
          cookie: creatorCookie,
        },
      );
      assert.equal(deleteResponse.status, 200);

      const [deletedRows] = await testConnection.query<RowDataPacket[]>(
        "SELECT account_id FROM creator_social_accounts WHERE account_id = ?",
        [accountId],
      );
      assert.equal(deletedRows.length, 0);
    });

    await test("brand dashboard only shows the authenticated brand data", async () => {
      const response = await http("/brand/dashboard", {
        cookie: brandCookie,
      });
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(html, /Welcome back, NovaThread Apparel\./);
      assert.match(html, /brand\.novathread@creatorconnect\.local/);
      assert.doesNotMatch(html, /brand\.pixelforge@creatorconnect\.local/);
      assert.doesNotMatch(html, /PixelForge Technologies/);
      assert.match(html, /My Campaigns/);
      assert.match(html, /Creator Applications/);
      assert.match(html, /Brand Profile/);

      assertMetric(
        html,
        "brand.campaigns.total",
        Object.values(brandCampaigns).reduce((sum, value) => sum + value, 0),
      );
      assertMetric(html, "brand.campaigns.open", brandCampaigns.Open ?? 0);
      assertMetric(
        html,
        "brand.campaigns.ongoing",
        brandCampaigns.Ongoing ?? 0,
      );
      assertMetric(
        html,
        "brand.campaigns.completed",
        brandCampaigns.Completed ?? 0,
      );
      assertMetric(
        html,
        "brand.applications.total",
        Object.values(brandApplications).reduce((sum, value) => sum + value, 0),
      );
      assertMetric(
        html,
        "brand.applications.pending",
        brandApplications.Pending ?? 0,
      );
      assertMetric(
        html,
        "brand.collaborations.active",
        brandCollaborations.Active ?? 0,
      );
      assertMetric(
        html,
        "brand.campaigns.budget",
        String(brandBudgetRows[0].total),
      );
      assert.match(html, /Payment summary/);
      assert.match(html, /Recent activity/);
    });

    await test("brand campaign list, creation, and management remain owner-scoped", async () => {
      const listResponse = await http("/api/brand/campaigns", {
        cookie: brandCookie,
      });
      const listBody = await json(listResponse);
      const listData = listBody.data as Record<string, unknown>;
      const initialCampaigns = listData.campaigns as Array<
        Record<string, unknown>
      >;
      const categories = listData.categories as Array<
        Record<string, unknown>
      >;

      assert.equal(listResponse.status, 200);
      assert.ok(Array.isArray(initialCampaigns));
      assert.ok(Array.isArray(categories));
      const [expectedApplicationCounts] =
        await testConnection!.query<RowDataPacket[]>(
          `SELECT ca.campaign_id,
                  COUNT(CASE WHEN request_collab.collaboration_id IS NULL
                             THEN a.application_id END) AS application_count
           FROM campaigns ca
           LEFT JOIN applications a ON a.campaign_id = ca.campaign_id
           LEFT JOIN collaborations request_collab
             ON request_collab.application_id = a.application_id
            AND request_collab.requested_by IS NOT NULL
           WHERE ca.brand_id = 1
           GROUP BY ca.campaign_id`,
        );
      const expectedCountsByCampaign = new Map(
        expectedApplicationCounts.map((row) => [
          Number(row.campaign_id),
          Number(row.application_count),
        ]),
      );
      for (const campaign of initialCampaigns) {
        assert.equal(
          Number(campaign.applicationCount),
          expectedCountsByCampaign.get(Number(campaign.campaignId)),
        );
      }

      const endDate = new Date();
      endDate.setUTCDate(endDate.getUTCDate() + 30);
      const campaignName = `Dashboard integration ${suffix}`;
      const createResponse = await http("/api/brand/campaigns", {
        method: "POST",
        cookie: brandCookie,
        json: {
          campaignName,
          description: "Campaign CRUD integration test.",
          categoryId: null,
          budget: "15000",
          minFollowers: "0",
          creatorLimit: "3",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
        },
      });
      const createBody = await json(createResponse);
      const createdCampaignId = Number(
        (createBody.data as Record<string, unknown>).campaignId,
      );
      assert.equal(createResponse.status, 201);
      assert.ok(Number.isInteger(createdCampaignId) && createdCampaignId > 0);

      const [createdRows] = await testConnection!.query<RowDataPacket[]>(
        `SELECT campaign_id, brand_id, campaign_name, max_creators,
                creator_limit, status
         FROM campaigns WHERE campaign_id = ?`,
        [createdCampaignId],
      );
      assert.equal(createdRows.length, 1);
      assert.equal(Number(createdRows[0].brand_id), 1);
      assert.equal(createdRows[0].campaign_name, campaignName);
      assert.equal(Number(createdRows[0].max_creators), 3);
      assert.equal(Number(createdRows[0].creator_limit), 3);
      assert.equal(createdRows[0].status, "Open");

      const invalidResponse = await http("/api/brand/campaigns", {
        method: "POST",
        cookie: brandCookie,
        json: {
          campaignName: "Invalid range",
          budget: "15000",
          startDate: "2027-01-02",
          endDate: "2027-01-01",
        },
      });
      assert.equal(invalidResponse.status, 400);

      const unauthorizedResponse = await http("/api/brand/campaigns", {
        method: "POST",
        cookie: creatorCookie,
        json: {
          campaignName: "Unauthorized campaign",
          budget: "1000",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
        },
      });
      assert.equal(unauthorizedResponse.status, 403);

      const updateResponse = await http(
        `/api/brand/campaigns/${createdCampaignId}`,
        {
          method: "PATCH",
          cookie: brandCookie,
          json: { status: "Ongoing" },
        },
      );
      assert.equal(updateResponse.status, 200);

      const [updatedRows] = await testConnection!.query<RowDataPacket[]>(
        "SELECT status FROM campaigns WHERE campaign_id = ? AND brand_id = 1",
        [createdCampaignId],
      );
      assert.equal(updatedRows[0].status, "Ongoing");

      const [otherBrandRows] = await testConnection!.query<RowDataPacket[]>(
        "SELECT campaign_id FROM campaigns WHERE brand_id <> 1 LIMIT 1",
      );
      if (otherBrandRows[0]) {
        const crossBrandResponse = await http(
          `/api/brand/campaigns/${otherBrandRows[0].campaign_id}`,
          {
            method: "PATCH",
            cookie: brandCookie,
            json: { status: "Completed" },
          },
        );
        assert.equal(crossBrandResponse.status, 404);
      }

      const refreshedResponse = await http("/api/brand/campaigns", {
        cookie: brandCookie,
      });
      const refreshedBody = await json(refreshedResponse);
      const refreshedCampaigns = (
        (refreshedBody.data as Record<string, unknown>).campaigns as Array<
          Record<string, unknown>
        >
      );
      assert.ok(
        refreshedCampaigns.some(
          (campaign) => Number(campaign.campaignId) === createdCampaignId,
        ),
      );
      await testConnection!.execute(
        "DELETE FROM campaigns WHERE campaign_id = ? AND brand_id = 1",
        [createdCampaignId],
      );
    });

    await test("brand profile loads and updates only the session brand", async () => {
      const pageResponse = await http("/brand/profile", {
        cookie: brandCookie,
      });
      const pageHtml = await pageResponse.text();

      assert.equal(pageResponse.status, 200);
      assert.match(pageHtml, /brand\.novathread@creatorconnect\.local/);

      const updateResponse = await http("/api/brand/profile", {
        method: "PATCH",
        cookie: brandCookie,
        json: {
          brandId: 2,
          brandName: "NovaThread Apparel Phase4",
          industry: "Fashion",
          contactNumber: "+91-98765-10011",
          address: "5 MG Road",
          city: "Bengaluru",
          state: "Karnataka",
        },
      });
      const updateBody = await json(updateResponse);
      const updated = (updateBody.data as Record<string, unknown>)
        .profile as Record<string, unknown>;

      assert.equal(updateResponse.status, 200);
      assert.equal(updated.brandId, 1);
      assert.equal(updated.brandName, "NovaThread Apparel Phase4");

      assert.ok(testConnection);
      const [rows] = await testConnection.query<RowDataPacket[]>(
        "SELECT brand_id, brand_name, contact_number FROM brands WHERE brand_id IN (1, 2) ORDER BY brand_id",
      );
      assert.equal(rows[0].brand_name, "NovaThread Apparel Phase4");
      assert.equal(rows[0].contact_number, "+91-98765-10011");
      assert.equal(rows[1].brand_name, "PixelForge Technologies");
    });

    await test("brand profile rejects invalid data and cross-role writes", async () => {
      for (const payload of [
        {
          brandName: "",
          industry: "Fashion",
          contactNumber: "",
          address: "",
          city: "",
          state: "",
        },
        {
          brandName: "NovaThread Apparel",
          industry: "Fashion",
          contactNumber: "1234567890123456",
          address: "",
          city: "",
          state: "",
        },
      ]) {
        const response = await http("/api/brand/profile", {
          method: "PATCH",
          cookie: brandCookie,
          json: payload,
        });
        assert.equal(response.status, 400);
      }

      const creatorWrite = await http("/api/brand/profile", {
        method: "PATCH",
        cookie: creatorCookie,
        json: {
          brandName: "Hijacked Brand",
          industry: "",
          contactNumber: "",
          address: "",
          city: "",
          state: "",
        },
      });
      assert.equal(creatorWrite.status, 403);
    });

    await test("creator and brand workspaces are isolated in both directions", async () => {
      const creatorToBrand = await http("/brand/dashboard", {
        cookie: creatorCookie,
      });
      const creatorToAdmin = await http("/admin/dashboard", {
        cookie: creatorCookie,
      });
      const brandToCreator = await http("/creator/dashboard", {
        cookie: brandCookie,
      });
      const brandToAdmin = await http("/admin/dashboard", {
        cookie: brandCookie,
      });

      for (const response of [
        creatorToBrand,
        creatorToAdmin,
        brandToCreator,
        brandToAdmin,
      ]) {
        assert.equal(response.status, 307);
        assert.match(response.headers.get("location") ?? "", /\/forbidden$/);
      }

      const creatorBrandProfile = await http("/api/brand/profile", {
        cookie: creatorCookie,
      });
      const brandCreatorProfile = await http("/api/creator/profile", {
        cookie: brandCookie,
      });

      assert.equal(creatorBrandProfile.status, 403);
      assert.equal(brandCreatorProfile.status, 403);
    });

    await test("admin dashboard exposes platform-wide read-only statistics", async () => {
      const response = await http("/admin/dashboard", {
        cookie: adminCookie,
      });
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(html, /Administrator dashboard/);
      assert.match(html, /Platform overview/);
      assert.match(html, /Recent users/);
      assert.match(html, /Recent campaigns/);
      assert.match(html, /Recent collaborations/);
      assert.match(html, /Payment oversight/);

      assertMetric(html, "admin.users.total", Number(metrics.users));
      assertMetric(html, "admin.creators.total", Number(metrics.creators));
      assertMetric(html, "admin.brands.total", Number(metrics.brands));
      assertMetric(html, "admin.campaigns.total", Number(metrics.campaigns));
      assertMetric(
        html,
        "admin.collaborations.total",
        Number(metrics.collaborations),
      );
      assertMetric(
        html,
        "admin.collaborations.completed",
        Number(metrics.completed_collaborations),
      );
      assertMetric(html, "admin.payments.total", Number(metrics.payments));
      assertMetric(
        html,
        "admin.activity.total",
        Number(metrics.applications) +
          Number(metrics.submissions) +
          Number(metrics.reviews) +
          Number(metrics.collaborations),
      );

      const adminCreatorProfile = await http("/api/creator/profile", {
        cookie: adminCookie,
      });
      assert.equal(adminCreatorProfile.status, 403);

      const creatorAdminPage = await http("/admin/dashboard", {
        cookie: creatorCookie,
      });
      assert.equal(creatorAdminPage.status, 307);
      assert.match(
        creatorAdminPage.headers.get("location") ?? "",
        /\/forbidden$/,
      );
    });

    await test("live database retains its existing rows after the run", async () => {
      let total = 0;

      for (const table of BASE_TABLES) {
        const [rows] = await adminConnection.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS count FROM \`${liveDatabase}\`.\`${table}\``,
        );
        const count = Number(rows[0].count);
        assert.equal(count, liveCounts.get(table));
        total += count;
      }

      assert.equal(total, liveTotal);
    });

    console.log(
      `\nDASHBOARD TEST SUMMARY: ${passed} passed, 0 failed (temporary database ${testDatabase}).`,
    );
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await delay(300);
    }

    if (testConnection) {
      await testConnection.end();
    }

    if (testDatabase.startsWith("creatorconnect_phase4_test_")) {
      await adminConnection.query(`DROP DATABASE IF EXISTS \`${testDatabase}\``);
    }

    await adminConnection.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    `DASHBOARD TEST FAILED: ${
      error instanceof Error ? error.message : "Unknown error"
    }`,
  );
  process.exitCode = 1;
});
