import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/db";
import type { AdminCategoryInput } from "@/lib/validations/admin";

type CategoryRow = RowDataPacket & {
  category_id: number;
  category_name: string;
};

export type AdminCategory = {
  categoryId: number;
  categoryName: string;
};

export class AdminCategoryError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "IN_USE",
    message: string,
  ) {
    super(message);
    this.name = "AdminCategoryError";
  }
}

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const [rows] = await pool.execute<CategoryRow[]>(
    `SELECT category_id, category_name
     FROM campaign_categories
     ORDER BY category_name ASC, category_id ASC`,
  );
  return rows.map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
  }));
}

export async function createAdminCategory(
  input: AdminCategoryInput,
): Promise<AdminCategory> {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO campaign_categories (category_name) VALUES (?)",
    [input.categoryName],
  );
  return {
    categoryId: result.insertId,
    categoryName: input.categoryName,
  };
}

export async function updateAdminCategory(
  categoryId: number,
  input: AdminCategoryInput,
): Promise<AdminCategory> {
  const connection = await pool.getConnection();
  let transactionStarted = false;
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.execute<CategoryRow[]>(
      `SELECT category_id
       FROM campaign_categories
       WHERE category_id = ?
       FOR UPDATE`,
      [categoryId],
    );
    if (rows.length === 0) {
      throw new AdminCategoryError("NOT_FOUND", "The category was not found.");
    }

    await connection.execute<ResultSetHeader>(
      "UPDATE campaign_categories SET category_name = ? WHERE category_id = ?",
      [input.categoryName, categoryId],
    );
    await connection.commit();
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        connection.destroy();
        connectionDestroyed = true;
        console.error("Admin category update rollback failed:", rollbackError);
      }
    }
    throw error;
  } finally {
    if (!connectionDestroyed) {
      connection.release();
    }
  }
  return { categoryId, categoryName: input.categoryName };
}

export async function deleteAdminCategory(categoryId: number): Promise<void> {
  const connection = await pool.getConnection();
  let transactionStarted = false;
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [categoryRows] = await connection.execute<CategoryRow[]>(
      `SELECT category_id, category_name
       FROM campaign_categories
       WHERE category_id = ?
       FOR UPDATE`,
      [categoryId],
    );
    if (categoryRows.length === 0) {
      throw new AdminCategoryError("NOT_FOUND", "The category was not found.");
    }

    const [campaignRows] = await connection.execute<
      (RowDataPacket & { campaign_count: number })[]
    >(
      "SELECT COUNT(*) AS campaign_count FROM campaigns WHERE category_id = ?",
      [categoryId],
    );
    if (Number(campaignRows[0]?.campaign_count ?? 0) > 0) {
      throw new AdminCategoryError(
        "IN_USE",
        "Categories assigned to campaigns cannot be deleted.",
      );
    }

    await connection.execute(
      "DELETE FROM campaign_categories WHERE category_id = ?",
      [categoryId],
    );
    await connection.commit();
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        connection.destroy();
        connectionDestroyed = true;
        console.error("Admin category deletion rollback failed:", rollbackError);
      }
    }
    throw error;
  } finally {
    if (!connectionDestroyed) {
      connection.release();
    }
  }
}
