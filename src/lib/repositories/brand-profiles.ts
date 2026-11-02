import type { RowDataPacket } from "mysql2/promise";

import { execute, query } from "@/lib/db";
import type { BrandProfileInput } from "@/lib/validations/profiles";

type BrandProfileRow = RowDataPacket & {
  brand_id: number;
  user_id: number;
  username: string;
  email: string;
  brand_name: string;
  industry: string | null;
  contact_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
};

export type BrandProfileRecord = {
  brandId: number;
  userId: number;
  username: string;
  email: string;
  brandName: string;
  industry: string | null;
  contactNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
};

function mapProfile(row: BrandProfileRow): BrandProfileRecord {
  return {
    brandId: row.brand_id,
    userId: row.user_id,
    username: row.username,
    email: row.email,
    brandName: row.brand_name,
    industry: row.industry,
    contactNumber: row.contact_number,
    address: row.address,
    city: row.city,
    state: row.state,
  };
}

export async function getBrandProfile(
  brandId: number,
): Promise<BrandProfileRecord | null> {
  const rows = await query<BrandProfileRow[]>(
    `SELECT
       b.brand_id, b.user_id, u.username, u.email, b.brand_name, b.industry,
       b.contact_number, b.address, b.city, b.state
     FROM brands b
     INNER JOIN users u ON u.user_id = b.user_id
     WHERE b.brand_id = ?
     LIMIT 1`,
    [brandId],
  );

  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function updateBrandProfile(
  brandId: number,
  input: BrandProfileInput,
): Promise<BrandProfileRecord | null> {
  await execute(
    `UPDATE brands
     SET brand_name = ?, industry = ?, contact_number = ?, address = ?,
         city = ?, state = ?
     WHERE brand_id = ?`,
    [
      input.brandName,
      input.industry,
      input.contactNumber,
      input.address,
      input.city,
      input.state,
      brandId,
    ],
  );

  return getBrandProfile(brandId);
}
