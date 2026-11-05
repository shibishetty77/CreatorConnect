import type { RowDataPacket } from "mysql2/promise";

import { closePool, execute, query } from "../src/lib/db";

type ColumnRow = RowDataPacket & { column_name: string; column_type: string };
type IndexRow = RowDataPacket & { index_name: string };

async function hasColumn(table: string, column: string): Promise<boolean> {
  const rows = await query<ColumnRow[]>(
    `SELECT COLUMN_NAME AS column_name, COLUMN_TYPE AS column_type
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
     LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function hasIndex(table: string, index: string): Promise<boolean> {
  const rows = await query<IndexRow[]>(
    `SELECT INDEX_NAME AS index_name
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
     LIMIT 1`,
    [table, index],
  );
  return rows.length > 0;
}

async function main(): Promise<void> {
  const statusRows = await query<ColumnRow[]>(
    `SELECT COLUMN_NAME AS column_name, COLUMN_TYPE AS column_type
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'collaborations'
       AND column_name = 'status'
     LIMIT 1`,
  );
  const statusType = statusRows[0]?.column_type ?? "";
  const desiredStatus =
    "enum('Pending','Active','Completed','Rejected')";

  if (statusType !== desiredStatus) {
    await execute(
      `ALTER TABLE collaborations
       MODIFY COLUMN status ENUM('Pending', 'Active', 'Completed', 'Rejected')
       NULL DEFAULT 'Active'`,
    );
    console.info("Extended collaborations.status with Pending and Rejected.");
  } else {
    console.info("collaborations.status already supports request states.");
  }

  const columns: Array<{ name: string; definition: string }> = [
    { name: "title", definition: "VARCHAR(150) NULL AFTER application_id" },
    { name: "description", definition: "TEXT NULL AFTER title" },
    {
      name: "deliverable_description",
      definition: "TEXT NULL AFTER description",
    },
    {
      name: "additional_requirements",
      definition: "TEXT NULL AFTER deliverable_description",
    },
    {
      name: "requested_by",
      definition: "ENUM('Brand', 'Creator') NULL AFTER additional_requirements",
    },
    {
      name: "decided_at",
      definition: "TIMESTAMP NULL DEFAULT NULL AFTER status",
    },
    {
      name: "created_at",
      definition: "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER decided_at",
    },
  ];

  for (const column of columns) {
    if (await hasColumn("collaborations", column.name)) {
      console.info(`collaborations.${column.name} already exists.`);
      continue;
    }
    await execute(
      `ALTER TABLE collaborations ADD COLUMN ${column.name} ${column.definition}`,
    );
    console.info(`Added collaborations.${column.name}.`);
  }

  if (!(await hasIndex("collaborations", "idx_collaboration_request_status"))) {
    await execute(
      `ALTER TABLE collaborations
       ADD INDEX idx_collaboration_request_status (requested_by, status)`,
    );
    console.info("Added idx_collaboration_request_status.");
  }

  const result = await execute(
    `UPDATE collaborations co
     INNER JOIN applications a ON a.application_id = co.application_id
     INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
     SET co.title = ca.campaign_name
     WHERE co.title IS NULL`,
  );
  console.info(`Backfilled ${result.affectedRows} collaboration title(s).`);
}

void main()
  .catch((error: unknown) => {
    console.error(
      "Collaboration request migration failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
