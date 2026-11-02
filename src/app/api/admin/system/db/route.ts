import type { RowDataPacket } from "mysql2/promise";

import { apiError, apiSuccess } from "@/lib/api/response";
import { requireApiRole } from "@/lib/auth/api";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const expectedTables = [
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
] as const;

const expectedTriggers = [
  "update_collaboration_after_payment",
  "complete_collaboration_after_payment_insert",
] as const;

type TableRow = RowDataPacket & {
  table_name: string;
  table_type: string;
  table_rows: number | string | null;
};

type ObjectRow = RowDataPacket & { object_name: string };
type DatabaseRow = RowDataPacket & { database_name: string; version: string };

export async function GET() {
  const actor = await requireApiRole("Admin");
  if (actor.error) return actor.error;

  try {
    const [databaseRows, tableRows, triggerRows, procedureRows, viewRows] =
      await Promise.all([
        query<DatabaseRow[]>(
          "SELECT DATABASE() AS database_name, VERSION() AS version",
        ),
        query<TableRow[]>(
          `SELECT TABLE_NAME AS table_name, TABLE_TYPE AS table_type, TABLE_ROWS AS table_rows
           FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = DATABASE()`,
        ),
        query<ObjectRow[]>(
          `SELECT TRIGGER_NAME AS object_name
           FROM information_schema.TRIGGERS
           WHERE TRIGGER_SCHEMA = DATABASE()`,
        ),
        query<ObjectRow[]>(
          `SELECT ROUTINE_NAME AS object_name
           FROM information_schema.ROUTINES
           WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'PROCEDURE'`,
        ),
        query<ObjectRow[]>(
          `SELECT TABLE_NAME AS object_name
           FROM information_schema.VIEWS
           WHERE TABLE_SCHEMA = DATABASE()`,
        ),
      ]);

    const tables = tableRows
      .filter((row) => row.table_type === "BASE TABLE")
      .map((row) => ({
        name: row.table_name,
        estimatedRows: row.table_rows === null ? null : Number(row.table_rows),
      }));
    const availableTableNames = new Set(tables.map((table) => table.name.toLowerCase()));
    const availableTriggers = new Set(triggerRows.map((row) => row.object_name));
    const availableProcedures = new Set(procedureRows.map((row) => row.object_name));
    const availableViews = new Set(viewRows.map((row) => row.object_name));
    const database = databaseRows[0];

    return apiSuccess({
      database: database?.database_name ?? null,
      version: database?.version ?? null,
      tables,
      missingTables: expectedTables.filter((name) => !availableTableNames.has(name)),
      triggers: expectedTriggers.map((name) => ({
        name,
        present: availableTriggers.has(name),
      })),
      procedures: [
        { name: "get_campaign_creators", present: availableProcedures.has("get_campaign_creators") },
      ],
      views: [
        { name: "campaign_creator_summary", present: availableViews.has("campaign_creator_summary") },
      ],
    });
  } catch (error) {
    console.error("Admin database system report could not be loaded:", error);
    return apiError(500, "SYSTEM_REPORT_FAILED", "Database status could not be loaded.");
  }
}
