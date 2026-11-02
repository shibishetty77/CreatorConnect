import mysql, {
  type Pool,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

if (typeof window !== "undefined") {
  throw new Error(
    "The database module can only be imported from server-side code.",
  );
}

type QueryResult = RowDataPacket[] | RowDataPacket[][] | ResultSetHeader;

export type SqlParam =
  | string
  | number
  | bigint
  | boolean
  | Date
  | null
  | Buffer
  | Uint8Array;

const POOL_CONNECTION_LIMIT = 10;

const globalForDatabase = globalThis as typeof globalThis & {
  creatorConnectPool?: Pool;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required database environment variable: ${name}. ` +
        "Copy .env.example to .env and fill in the values.",
    );
  }

  return value;
}

function createPool(): Pool {
  const port = Number(requireEnv("DB_PORT"));

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be an integer between 1 and 65535.");
  }

  const options: PoolOptions = {
    host: requireEnv("DB_HOST"),
    port,
    database: requireEnv("DB_NAME"),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    waitForConnections: true,
    connectionLimit: POOL_CONNECTION_LIMIT,
    maxIdle: POOL_CONNECTION_LIMIT,
    idleTimeout: 60_000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: "utf8mb4",
    dateStrings: true,
    timezone: "Z",
  };

  return mysql.createPool(options);
}

export const pool: Pool =
  globalForDatabase.creatorConnectPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.creatorConnectPool = pool;
}

export async function query<T extends QueryResult = RowDataPacket[]>(
  sql: string,
  params: SqlParam[] = [],
): Promise<T> {
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
}

export async function execute(
  sql: string,
  params: SqlParam[] = [],
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

export async function checkDatabaseConnection(): Promise<{
  database: string;
  version: string;
}> {
  const rows = await query<RowDataPacket[]>(
    "SELECT DATABASE() AS database_name, VERSION() AS version",
  );

  const row = rows[0];

  return {
    database: String(row.database_name),
    version: String(row.version),
  };
}

export async function closePool(): Promise<void> {
  await pool.end();

  if (globalForDatabase.creatorConnectPool === pool) {
    delete globalForDatabase.creatorConnectPool;
  }
}
