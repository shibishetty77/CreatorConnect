import type { RowDataPacket } from "mysql2/promise";

import { execute, query } from "@/lib/db";
import type {
  CreatorProfileInput,
  SocialAccountInput,
} from "@/lib/validations/profiles";

type CreatorProfileRow = RowDataPacket & {
  creator_id: number;
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  phone: string | null;
  bio: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  profile_picture_url: string | null;
};

type SocialAccountRow = RowDataPacket & {
  account_id: number;
  platform: string;
  username: string;
  followers: number | string;
  engagement_rate: number | string;
  account_url: string | null;
};

export type CreatorProfileRecord = {
  creatorId: number;
  userId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phone: string | null;
  bio: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  profilePictureUrl: string | null;
};

export type SocialAccountRecord = {
  accountId: number;
  platform: string;
  username: string;
  followers: number;
  engagementRate: string;
  accountUrl: string | null;
};

function mapProfile(row: CreatorProfileRow): CreatorProfileRecord {
  return {
    creatorId: row.creator_id,
    userId: row.user_id,
    username: row.username,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    phone: row.phone,
    bio: row.bio,
    address: row.address,
    city: row.city,
    state: row.state,
    profilePictureUrl: row.profile_picture_url,
  };
}

function mapSocialAccount(row: SocialAccountRow): SocialAccountRecord {
  return {
    accountId: row.account_id,
    platform: row.platform,
    username: row.username,
    followers: Number(row.followers),
    engagementRate: Number(row.engagement_rate).toFixed(2),
    accountUrl: row.account_url,
  };
}

export async function getCreatorProfile(
  creatorId: number,
): Promise<CreatorProfileRecord | null> {
  const rows = await query<CreatorProfileRow[]>(
    `SELECT
       c.creator_id, c.user_id, u.username, u.email,
       c.first_name, c.last_name, c.date_of_birth, c.phone, c.bio,
       c.address, c.city, c.state, c.profile_picture_url
     FROM creators c
     INNER JOIN users u ON u.user_id = c.user_id
     WHERE c.creator_id = ?
     LIMIT 1`,
    [creatorId],
  );

  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function updateCreatorProfile(
  creatorId: number,
  input: CreatorProfileInput,
): Promise<CreatorProfileRecord | null> {
  await execute(
    `UPDATE creators
     SET first_name = ?, last_name = ?, date_of_birth = ?, phone = ?,
         bio = ?, address = ?, city = ?, state = ?, profile_picture_url = ?
     WHERE creator_id = ?`,
    [
      input.firstName,
      input.lastName,
      input.dateOfBirth,
      input.phone,
      input.bio,
      input.address,
      input.city,
      input.state,
      input.profilePictureUrl,
      creatorId,
    ],
  );

  return getCreatorProfile(creatorId);
}

export async function listSocialAccounts(
  creatorId: number,
): Promise<SocialAccountRecord[]> {
  const rows = await query<SocialAccountRow[]>(
    `SELECT account_id, platform, username, followers, engagement_rate, account_url
     FROM creator_social_accounts
     WHERE creator_id = ?
     ORDER BY followers DESC, account_id ASC`,
    [creatorId],
  );

  return rows.map(mapSocialAccount);
}

async function getSocialAccount(
  creatorId: number,
  accountId: number,
): Promise<SocialAccountRecord | null> {
  const rows = await query<SocialAccountRow[]>(
    `SELECT account_id, platform, username, followers, engagement_rate, account_url
     FROM creator_social_accounts
     WHERE creator_id = ? AND account_id = ?
     LIMIT 1`,
    [creatorId, accountId],
  );

  return rows[0] ? mapSocialAccount(rows[0]) : null;
}

export async function createSocialAccount(
  creatorId: number,
  input: SocialAccountInput,
): Promise<SocialAccountRecord | null> {
  const result = await execute(
    `INSERT INTO creator_social_accounts
       (creator_id, platform, username, followers, engagement_rate, account_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      creatorId,
      input.platform,
      input.username,
      input.followers,
      input.engagementRate,
      input.accountUrl,
    ],
  );

  return getSocialAccount(creatorId, result.insertId);
}

export async function updateSocialAccount(
  creatorId: number,
  accountId: number,
  input: SocialAccountInput,
): Promise<SocialAccountRecord | null> {
  await execute(
    `UPDATE creator_social_accounts
     SET platform = ?, username = ?, followers = ?, engagement_rate = ?,
         account_url = ?
     WHERE account_id = ? AND creator_id = ?`,
    [
      input.platform,
      input.username,
      input.followers,
      input.engagementRate,
      input.accountUrl,
      accountId,
      creatorId,
    ],
  );

  return getSocialAccount(creatorId, accountId);
}

export async function deleteSocialAccount(
  creatorId: number,
  accountId: number,
): Promise<boolean> {
  const result = await execute(
    "DELETE FROM creator_social_accounts WHERE account_id = ? AND creator_id = ?",
    [accountId, creatorId],
  );

  return result.affectedRows > 0;
}
