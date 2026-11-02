import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { execute, pool, query } from "@/lib/db";

import { isRole, type PublicRole, type Role } from "./constants";
import { DuplicateAccountError } from "./errors";
import type { AuthUser, LoginUser } from "./types";

type UserProfileRow = RowDataPacket & {
  user_id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
  creator_id: number | null;
  first_name: string | null;
  last_name: string | null;
  creator_phone: string | null;
  creator_city: string | null;
  creator_state: string | null;
  brand_id: number | null;
  brand_name: string | null;
  industry: string | null;
  contact_number: string | null;
  brand_city: string | null;
  brand_state: string | null;
};

type LoginUserRow = RowDataPacket & {
  user_id: number;
  username: string;
  email: string;
  password_hash: string;
  role: string;
};

type ExistingAccountRow = RowDataPacket & {
  user_id: number;
  email: string;
  username: string;
  role: string;
};

const USER_PROFILE_SELECT = `
  SELECT
    u.user_id,
    u.username,
    u.email,
    u.role,
    u.created_at,
    c.creator_id,
    c.first_name,
    c.last_name,
    c.phone AS creator_phone,
    c.city AS creator_city,
    c.state AS creator_state,
    b.brand_id,
    b.brand_name,
    b.industry,
    b.contact_number,
    b.city AS brand_city,
    b.state AS brand_state
  FROM users u
  LEFT JOIN creators c ON c.user_id = u.user_id
  LEFT JOIN brands b ON b.user_id = u.user_id
`;

function mapUser(row: UserProfileRow): AuthUser {
  if (!isRole(row.role)) {
    throw new Error("The account has an unsupported role.");
  }

  return {
    userId: row.user_id,
    username: row.username,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    creatorProfile:
      row.creator_id === null
        ? null
        : {
            creatorId: row.creator_id,
            firstName: row.first_name ?? "",
            lastName: row.last_name ?? "",
            phone: row.creator_phone,
            city: row.creator_city,
            state: row.creator_state,
          },
    brandProfile:
      row.brand_id === null
        ? null
        : {
            brandId: row.brand_id,
            brandName: row.brand_name ?? "",
            industry: row.industry,
            contactNumber: row.contact_number,
            city: row.brand_city,
            state: row.brand_state,
          },
  };
}

export async function getUserWithProfileById(
  userId: number,
): Promise<AuthUser | null> {
  const rows = await query<UserProfileRow[]>(
    `${USER_PROFILE_SELECT} WHERE u.user_id = ? LIMIT 1`,
    [userId],
  );

  const row = rows[0];
  return row ? mapUser(row) : null;
}

export async function findUserByLogin(
  identifier: string,
): Promise<LoginUser | null> {
  const normalized = identifier.trim().toLowerCase();
  const rows = await query<LoginUserRow[]>(
    `SELECT user_id, username, email, password_hash, role
     FROM users
     WHERE email = ? OR username = ?
     LIMIT 1`,
    [normalized, identifier.trim()],
  );

  const row = rows[0];

  if (!row || !isRole(row.role)) {
    return null;
  }

  return {
    userId: row.user_id,
    username: row.username,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
  };
}

function duplicateAccountError(error: unknown): DuplicateAccountError | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    error.code !== "ER_DUP_ENTRY"
  ) {
    return null;
  }

  const message =
    "sqlMessage" in error && typeof error.sqlMessage === "string"
      ? error.sqlMessage.toLowerCase()
      : "";

  if (message.includes("email")) {
    return new DuplicateAccountError("email");
  }

  return new DuplicateAccountError("username");
}

export type CreateUserInput = {
  username: string;
  email: string;
  name: string;
  passwordHash: string;
  role: PublicRole;
};

export async function createUserWithProfile(
  input: CreateUserInput,
): Promise<AuthUser> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      [input.username, input.email, input.passwordHash, input.role],
    );

    const userId = userResult.insertId;

    if (input.role === "Creator") {
      const parts = input.name.trim().split(/\s+/);
      const firstName = parts.shift() ?? input.name.trim();
      const lastName = parts.join(" ") || firstName;

      await connection.execute(
        `INSERT INTO creators (user_id, first_name, last_name)
         VALUES (?, ?, ?)`,
        [userId, firstName, lastName],
      );
    } else {
      await connection.execute(
        `INSERT INTO brands (user_id, brand_name)
         VALUES (?, ?)`,
        [userId, input.name.trim()],
      );
    }

    await connection.commit();

    const user = await getUserWithProfileById(userId);

    if (!user) {
      throw new Error("The new account could not be loaded.");
    }

    return user;
  } catch (error) {
    await connection.rollback();
    const duplicate = duplicateAccountError(error);

    if (duplicate) {
      throw duplicate;
    }

    throw error;
  } finally {
    connection.release();
  }
}

export type BootstrapAdminInput = {
  username: string;
  email: string;
  passwordHash: string;
};

export type BootstrapAdminResult =
  | { status: "created"; userId: number }
  | { status: "exists"; userId: number };

export async function bootstrapAdmin(
  input: BootstrapAdminInput,
): Promise<BootstrapAdminResult> {
  const rows = await query<ExistingAccountRow[]>(
    `SELECT user_id, email, username, role
     FROM users
     WHERE email = ? OR username = ?
     LIMIT 1`,
    [input.email, input.username],
  );

  const existing = rows[0];

  if (existing) {
    if (
      existing.role !== "Admin" ||
      existing.email.toLowerCase() !== input.email.toLowerCase() ||
      existing.username.toLowerCase() !== input.username.toLowerCase()
    ) {
      throw new Error(
        "The email or username is already used by a non-admin account.",
      );
    }

    return { status: "exists", userId: existing.user_id };
  }

  const result = await execute(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES (?, ?, ?, 'Admin')`,
    [input.username, input.email, input.passwordHash],
  );

  return { status: "created", userId: result.insertId };
}

export async function userExistsByEmail(email: string): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    "SELECT 1 FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  return rows.length > 0;
}

export function roleLabel(role: Role): string {
  return role;
}
