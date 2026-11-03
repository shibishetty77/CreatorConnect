import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";

import { SignJWT } from "jose";
import mysql, {
  type Connection,
  type RowDataPacket,
} from "mysql2/promise";

const CREATOR = {
  username: "test.creator",
  email: "creator@auth-test.local",
  name: "Test Creator",
  password: "CreatorPass123",
};

const BRAND = {
  username: "test.brand",
  email: "brand@auth-test.local",
  name: "Test Brand Studio",
  password: "BrandPass123",
};

const ADMIN = {
  username: "admin_platform",
  email: "admin@auth-test.local",
  password: "AdminPass123",
};

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

function sessionCookieFrom(response: Response): string {
  const setCookies = response.headers.getSetCookie();
  const cookie = setCookies.find((value) =>
    value.startsWith("cc_session="),
  );

  assert.ok(cookie, "Expected a cc_session cookie in the response.");

  const pair = cookie.split(";")[0];

  assert.ok(pair && pair.length > "cc_session=".length, "Session cookie is empty.");

  return pair;
}

function assertCookieFlags(response: Response): void {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("cc_session="));

  assert.ok(cookie, "Expected a session cookie.");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\//i);
  assert.match(cookie, /Secure/i);
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

async function runAdminBootstrap(
  testDatabase: string,
  dbEnv: Record<string, string>,
): Promise<void> {
  const args = [
    "--env-file-if-exists=.env",
    "--env-file-if-exists=.env.local",
    "--import",
    "tsx",
    "scripts/create-admin.ts",
  ];

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...dbEnv,
      DB_NAME: testDatabase,
      ADMIN_USERNAME: ADMIN.username,
      ADMIN_EMAIL: ADMIN.email,
      ADMIN_PASSWORD: ADMIN.password,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout?.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    output += chunk.toString();
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.once("exit", (code) => resolve(code));
  });

  assert.equal(exitCode, 0, `Admin bootstrap failed.\n${output}`);
  assert.match(output, /Admin account created/);
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

  const dbEnv = {
    DB_HOST: host,
    DB_PORT: String(port),
    DB_USER: user,
    DB_PASSWORD: password,
  };

  const suffix = `${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const testDatabase = `creatorconnect_auth_test_${suffix}`;

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
        UNIQUE KEY email (email),
        KEY idx_users_role (role)
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
        UNIQUE KEY user_id (user_id),
        CONSTRAINT fk_test_creator_user FOREIGN KEY (user_id)
          REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE
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
        UNIQUE KEY user_id (user_id),
        CONSTRAINT fk_test_brand_user FOREIGN KEY (user_id)
          REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE
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
        PRIMARY KEY (application_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE collaborations (
        collaboration_id INT NOT NULL AUTO_INCREMENT,
        application_id INT NOT NULL,
        agreed_amount DECIMAL(12,2) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status ENUM('Active','Completed') DEFAULT 'Active',
        PRIMARY KEY (collaboration_id)
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

    await testConnection.query(`
      CREATE TABLE content_submissions (
        submission_id INT NOT NULL AUTO_INCREMENT,
        deliverable_id INT NOT NULL,
        content_url VARCHAR(500) NOT NULL,
        submitted_date DATE DEFAULT (CURRENT_DATE),
        approval_status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
        PRIMARY KEY (submission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE payments (
        payment_id INT NOT NULL AUTO_INCREMENT,
        collaboration_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_date DATE DEFAULT NULL,
        status ENUM('Pending','Paid') DEFAULT 'Pending',
        transaction_reference VARCHAR(100) DEFAULT NULL,
        PRIMARY KEY (payment_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE performance_metrics (
        metric_id INT NOT NULL AUTO_INCREMENT,
        collaboration_id INT NOT NULL,
        views BIGINT DEFAULT 0,
        likes BIGINT DEFAULT 0,
        comments BIGINT DEFAULT 0,
        shares BIGINT DEFAULT 0,
        clicks BIGINT DEFAULT 0,
        PRIMARY KEY (metric_id),
        UNIQUE KEY collaboration_id (collaboration_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await testConnection.query(`
      CREATE TABLE reviews (
        review_id INT NOT NULL AUTO_INCREMENT,
        collaboration_id INT NOT NULL,
        rating INT NOT NULL,
        feedback TEXT,
        review_date DATE DEFAULT (CURRENT_DATE),
        PRIMARY KEY (review_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await runAdminBootstrap(testDatabase, dbEnv);

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

    let creatorCookie = "";
    let brandCookie = "";
    let adminCookie = "";

    await test("unauthenticated protected page redirects to login", async () => {
      const response = await http("/creator/dashboard");
      assert.equal(response.status, 307);
      const location = response.headers.get("location") ?? "";
      assert.match(location, /\/login\?next=/);
    });

    await test("creator registration creates user and profile", async () => {
      const response = await http("/api/auth/register", {
        method: "POST",
        json: {
          username: CREATOR.username,
          name: CREATOR.name,
          email: CREATOR.email,
          password: CREATOR.password,
          confirmPassword: CREATOR.password,
          role: "Creator",
        },
      });

      assert.equal(response.status, 201);
      assertCookieFlags(response);
      creatorCookie = sessionCookieFrom(response);

      const payload = await json(response);
      assert.equal(
        (payload.data as Record<string, unknown>).redirectTo,
        "/creator/dashboard",
      );
      assert.doesNotMatch(JSON.stringify(payload), /password/i);

      assert.ok(testConnection);
      const [rows] = await testConnection.execute<RowDataPacket[]>(
        `SELECT u.password_hash, u.role, c.creator_id, c.first_name, c.last_name
         FROM users u LEFT JOIN creators c ON c.user_id = u.user_id
         WHERE u.email = ?`,
        [CREATOR.email],
      );

      assert.equal(rows.length, 1);
      assert.equal(rows[0].role, "Creator");
      assert.notEqual(rows[0].password_hash, CREATOR.password);
      assert.match(String(rows[0].password_hash), /^\$2[aby]\$12\$/);
      assert.ok(rows[0].creator_id);
      assert.equal(rows[0].first_name, "Test");
      assert.equal(rows[0].last_name, "Creator");
    });

    await test("creator can read own profile", async () => {
      const response = await http("/api/auth/me", {
        cookie: creatorCookie,
      });

      assert.equal(response.status, 200);
      const payload = await json(response);
      const data = payload.data as Record<string, unknown>;
      const user = data.user as Record<string, unknown>;

      assert.equal(user.email, CREATOR.email);
      assert.equal(user.role, "Creator");
      assert.doesNotMatch(JSON.stringify(payload), /password/i);
    });

    await test("creator can open creator dashboard", async () => {
      const response = await http("/creator/dashboard", {
        cookie: creatorCookie,
      });

      assert.equal(response.status, 200);
      assert.match(await response.text(), /Welcome back, Test\./);
    });

    await test("creator cannot open brand or admin dashboards", async () => {
      const brandResponse = await http("/brand/dashboard", {
        cookie: creatorCookie,
      });
      const adminResponse = await http("/admin/dashboard", {
        cookie: creatorCookie,
      });

      assert.equal(brandResponse.status, 307);
      assert.equal(adminResponse.status, 307);
      assert.match(brandResponse.headers.get("location") ?? "", /\/forbidden$/);
      assert.match(adminResponse.headers.get("location") ?? "", /\/forbidden$/);
    });

    await test("duplicate email registration is rejected", async () => {
      const response = await http("/api/auth/register", {
        method: "POST",
        json: {
          username: "test.creator.duplicate",
          name: "Another Creator",
          email: CREATOR.email,
          password: CREATOR.password,
          confirmPassword: CREATOR.password,
          role: "Creator",
        },
      });

      assert.equal(response.status, 409);
      const payload = await json(response);
      const error = payload.error as Record<string, unknown>;
      const fields = error.fields as Record<string, string>;

      assert.equal(fields.email, "An account with that email already exists.");

      assert.ok(testConnection);
      const [rows] = await testConnection.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM users WHERE email = ?",
        [CREATOR.email],
      );
      assert.equal(rows[0].count, 1);
    });

    await test("admin cannot be created through public registration", async () => {
      const email = "admin-attempt@auth-test.local";
      const response = await http("/api/auth/register", {
        method: "POST",
        json: {
          username: "admin.attempt",
          name: "Admin Attempt",
          email,
          password: "AdminAttempt123",
          confirmPassword: "AdminAttempt123",
          role: "Admin",
        },
      });

      assert.equal(response.status, 400);

      assert.ok(testConnection);
      const [rows] = await testConnection.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM users WHERE email = ?",
        [email],
      );
      assert.equal(rows[0].count, 0);
    });

    await test("brand registration creates user and brand profile", async () => {
      const response = await http("/api/auth/register", {
        method: "POST",
        json: {
          username: BRAND.username,
          name: BRAND.name,
          email: BRAND.email,
          password: BRAND.password,
          confirmPassword: BRAND.password,
          role: "Brand",
        },
      });

      assert.equal(response.status, 201);
      brandCookie = sessionCookieFrom(response);

      assert.ok(testConnection);
      const [rows] = await testConnection.execute<RowDataPacket[]>(
        `SELECT u.role, b.brand_id, b.brand_name
         FROM users u LEFT JOIN brands b ON b.user_id = u.user_id
         WHERE u.email = ?`,
        [BRAND.email],
      );

      assert.equal(rows.length, 1);
      assert.equal(rows[0].role, "Brand");
      assert.ok(rows[0].brand_id);
      assert.equal(rows[0].brand_name, BRAND.name);
    });

    await test("brand can open brand dashboard only", async () => {
      const brandResponse = await http("/brand/dashboard", {
        cookie: brandCookie,
      });
      const creatorResponse = await http("/creator/dashboard", {
        cookie: brandCookie,
      });
      const adminResponse = await http("/admin/dashboard", {
        cookie: brandCookie,
      });

      assert.equal(brandResponse.status, 200);
      assert.equal(creatorResponse.status, 307);
      assert.equal(adminResponse.status, 307);
      assert.match(
        creatorResponse.headers.get("location") ?? "",
        /\/forbidden$/,
      );
      assert.match(adminResponse.headers.get("location") ?? "", /\/forbidden$/);
    });

    await test("valid credentials create a session", async () => {
      const response = await http("/api/auth/login", {
        method: "POST",
        json: {
          identifier: CREATOR.email,
          password: CREATOR.password,
        },
      });

      assert.equal(response.status, 200);
      assertCookieFlags(response);
      creatorCookie = sessionCookieFrom(response);

      const payload = await json(response);
      const data = payload.data as Record<string, unknown>;
      assert.equal(data.redirectTo, "/creator/dashboard");
      assert.doesNotMatch(JSON.stringify(payload), /password/i);
    });

    await test("invalid and unknown credentials share a generic error", async () => {
      const wrongPassword = await http("/api/auth/login", {
        method: "POST",
        json: {
          identifier: CREATOR.email,
          password: "WrongPassword123",
        },
      });

      const unknownUser = await http("/api/auth/login", {
        method: "POST",
        json: {
          identifier: "missing@auth-test.local",
          password: "WrongPassword123",
        },
      });

      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownUser.status, 401);

      const wrongPayload = await json(wrongPassword);
      const unknownPayload = await json(unknownUser);
      const wrongMessage = (wrongPayload.error as Record<string, unknown>)
        .message;
      const unknownMessage = (unknownPayload.error as Record<string, unknown>)
        .message;

      assert.equal(wrongMessage, unknownMessage);
    });

    await test("login is rate limited after repeated failures", async () => {
      let lastStatus = 0;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await http("/api/auth/login", {
          method: "POST",
          json: {
            identifier: "rate-limit@auth-test.local",
            password: "WrongPassword123",
          },
        });

        lastStatus = response.status;

        if (attempt < 5) {
          assert.equal(response.status, 401);
        }
      }

      assert.equal(lastStatus, 429);
    });

    await test("session cookie is rejected after expiry", async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = await new SignJWT({
        username: CREATOR.username,
        role: "Creator",
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject("2")
        .setIssuedAt(now - 7200)
        .setExpirationTime(now - 3600)
        .sign(new TextEncoder().encode(authSecret));

      const meResponse = await http("/api/auth/me", {
        cookie: `cc_session=${expiredToken}`,
      });

      assert.equal(meResponse.status, 401);

      const pageResponse = await http("/dashboard", {
        cookie: `cc_session=${expiredToken}`,
      });
      assert.equal(pageResponse.status, 307);
      assert.match(pageResponse.headers.get("location") ?? "", /\/login/);
    });

    await test("tampered session cookie is rejected", async () => {
      const value = creatorCookie.slice("cc_session=".length);
      const tampered = `${value.slice(0, -1)}${
        value.endsWith("A") ? "B" : "A"
      }`;

      const response = await http("/api/auth/me", {
        cookie: `cc_session=${tampered}`,
      });

      assert.equal(response.status, 401);
    });

    await test("admin bootstrap login works and admin routes are isolated", async () => {
      const loginResponse = await http("/api/auth/login", {
        method: "POST",
        json: {
          identifier: ADMIN.email,
          password: ADMIN.password,
        },
      });

      assert.equal(loginResponse.status, 200);
      adminCookie = sessionCookieFrom(loginResponse);

      const adminPage = await http("/admin/dashboard", {
        cookie: adminCookie,
      });
      const creatorPage = await http("/creator/dashboard", {
        cookie: adminCookie,
      });
      const brandPage = await http("/brand/dashboard", {
        cookie: adminCookie,
      });

      assert.equal(adminPage.status, 200);
      assert.equal(creatorPage.status, 307);
      assert.equal(brandPage.status, 307);
      assert.match(
        creatorPage.headers.get("location") ?? "",
        /\/forbidden$/,
      );
      assert.match(brandPage.headers.get("location") ?? "", /\/forbidden$/);
    });

    await test("dashboard redirect respects the authenticated role", async () => {
      const response = await http("/dashboard", {
        cookie: creatorCookie,
      });

      assert.equal(response.status, 307);
      assert.match(
        response.headers.get("location") ?? "",
        /\/creator\/dashboard$/,
      );
    });

    await test("authenticated users are redirected away from login", async () => {
      const response = await http("/login", {
        cookie: brandCookie,
      });

      assert.equal(response.status, 307);
      assert.match(
        response.headers.get("location") ?? "",
        /\/brand\/dashboard$/,
      );
    });

    await test("logout clears the session cookie", async () => {
      const response = await http("/api/auth/logout", {
        method: "POST",
        cookie: creatorCookie,
        json: {},
      });

      assert.equal(response.status, 200);
      const cookie = response.headers
        .getSetCookie()
        .find((value) => value.startsWith("cc_session="));

      assert.ok(cookie);
      assert.match(cookie, /Max-Age=0/i);

      const meResponse = await http("/api/auth/me");
      assert.equal(meResponse.status, 401);
    });

    console.log(
      `\nAUTH TEST SUMMARY: ${passed} passed, 0 failed (database ${testDatabase}).`,
    );
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await delay(300);
    }

    if (testConnection) {
      await testConnection.end();
    }

    if (testDatabase.startsWith("creatorconnect_auth_test_")) {
      await adminConnection.query(`DROP DATABASE IF EXISTS \`${testDatabase}\``);
    }

    await adminConnection.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    `AUTH TEST FAILED: ${
      error instanceof Error ? error.message : "Unknown error"
    }`,
  );
  process.exitCode = 1;
});
