import type { RowDataPacket } from "mysql2/promise";

const EXPECTED_TABLES = [
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

type IdentityRow = RowDataPacket & {
  databaseName: string;
  version: string;
  lowerCaseTableNames: number;
};

type TableRow = RowDataPacket & {
  tableName: string;
  tableType: string;
  tableRows: number | string | null;
};

type ForeignKeyRow = RowDataPacket & {
  constraintName: string;
  tableName: string;
  columnName: string;
  referencedTableName: string;
  referencedColumnName: string;
};

async function main(): Promise<void> {
  const { pool, closePool } = await import("../src/lib/db");
  const connection = await pool.getConnection();

  try {
    const [identityRows] = await connection.execute<IdentityRow[]>(
      "SELECT DATABASE() AS databaseName, VERSION() AS version, @@lower_case_table_names AS lowerCaseTableNames",
    );
    const identity = identityRows[0];

    if (!identity) {
      throw new Error("MySQL did not return database identity information.");
    }

    const [tableRows] = await connection.execute<TableRow[]>(
      `SELECT TABLE_NAME AS tableName, TABLE_TYPE AS tableType, TABLE_ROWS AS tableRows
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_TYPE, TABLE_NAME`,
      [identity.databaseName],
    );

    const [foreignKeyRows] = await connection.execute<ForeignKeyRow[]>(
      `SELECT CONSTRAINT_NAME AS constraintName, TABLE_NAME AS tableName,
              COLUMN_NAME AS columnName, REFERENCED_TABLE_NAME AS referencedTableName,
              REFERENCED_COLUMN_NAME AS referencedColumnName
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY TABLE_NAME, CONSTRAINT_NAME`,
      [identity.databaseName],
    );

    const tables = tableRows.filter((row) => row.tableType === "BASE TABLE");
    const views = tableRows.filter((row) => row.tableType === "VIEW");
    const tableNames = new Set(tables.map((row) => row.tableName));
    const missingTables = EXPECTED_TABLES.filter((name) => !tableNames.has(name));

    console.log("SUCCESS: Connected to MySQL.");
    console.log(`Database: ${identity.databaseName}`);
    console.log(`MySQL version: ${identity.version}`);
    console.log(`lower_case_table_names: ${identity.lowerCaseTableNames}`);
    console.log(
      `Base tables: ${tables.length}; views: ${views.length}; foreign keys: ${foreignKeyRows.length}`,
    );

    console.log("\nBase tables (information_schema row estimates):");
    for (const table of tables) {
      const rowCount = table.tableRows === null ? "unknown" : table.tableRows;
      console.log(`  - ${table.tableName}: ~${rowCount} row(s)`);
    }

    if (views.length > 0) {
      console.log("\nViews:");
      for (const view of views) {
        console.log(`  - ${view.tableName}`);
      }
    }

    console.log("\nForeign keys:");
    for (const key of foreignKeyRows) {
      console.log(
        `  - ${key.tableName}.${key.columnName} -> ${key.referencedTableName}.${key.referencedColumnName} (${key.constraintName})`,
      );
    }

    console.log(
      `\nExpected tables present: ${EXPECTED_TABLES.length - missingTables.length}/${EXPECTED_TABLES.length}`,
    );

    if (missingTables.length > 0) {
      throw new Error(
        `Missing expected table(s): ${missingTables.join(", ")}`,
      );
    }

    console.log("Connection test PASSED.");
  } finally {
    connection.release();
    await closePool();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`FAILED: Database connection test failed. ${message}`);
  process.exitCode = 1;
});
