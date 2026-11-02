# CreatorConnect - Database Connection

**Phase:** Database connectivity and read-only verification  
**Status:** Connection verified locally on 2026-11-01  
**Database:** `creatorconnect`  
**MySQL server:** `8.0.46`  
**Runtime:** Node.js `24.4.1`, npm `11.4.2`  
**Framework:** Next.js `16.4.3` (App Router) + TypeScript `7.0.2`

> **Safety warning:** `DDL STATEMENTS.sql` begins with `DROP DATABASE IF EXISTS creatorconnect;`.
> Do not execute that file. It is reference documentation only. This phase made no schema,
> data, or constraint changes.

---

## 1. Architecture

```text
Server Components / Route Handlers / Server Actions / scripts
                              |
                              v
                     src/lib/db.ts
          (single mysql2/promise connection pool)
                              |
                              v
             MySQL 8.0 - creatorconnect database
```

`src/lib/db.ts` is the only database connection module.

- Uses `mysql2/promise`.
- Creates one pool per Node.js process.
- Reuses the pool through `globalThis` outside production, so Next.js development
  hot reloads do not create a new pool on every module reload.
- Reads every credential from server-side environment variables.
- Fails fast with a clear error when a required variable is missing.
- Throws if imported in a browser context.
- Uses `utf8mb4`, UTC timezone handling, and `dateStrings: true` so MySQL `DATE`
  values are returned as `YYYY-MM-DD` strings instead of timezone-shifted `Date`
  objects.
- Prepares parameterized statements through `pool.execute`.

### Pool settings

| Setting | Value |
| --- | --- |
| `connectionLimit` | `10` |
| `maxIdle` | `10` |
| `idleTimeout` | `60,000 ms` |
| `queueLimit` | `0` (unlimited wait queue) |
| `waitForConnections` | `true` |
| `enableKeepAlive` | `true` |
| `charset` | `utf8mb4` |
| `timezone` | `Z` |
| `dateStrings` | `true` |

`DECIMAL` columns are returned as strings by `mysql2`. Convert or validate them
explicitly in the server layer rather than relying on JavaScript floating point.

---

## 2. Required environment variables

| Variable | Example | Secret | Purpose |
| --- | --- | --- | --- |
| `DB_HOST` | `127.0.0.1` | No | MySQL host |
| `DB_PORT` | `3306` | No | MySQL TCP port |
| `DB_NAME` | `creatorconnect` | No | Database name |
| `DB_USER` | `your_mysql_user` | Yes | MySQL user |
| `DB_PASSWORD` | `your_mysql_password` | Yes | MySQL password |

All variables are server-only. No database variable uses the `NEXT_PUBLIC_` prefix.

`src/lib/db.ts` reads these variables from `process.env`. Next.js loads `.env` and
`.env.local` automatically for the application. The standalone test script uses
Node's built-in `--env-file-if-exists` flags.

---

## 3. Environment file policy

| File | Committed | Contents |
| --- | --- | --- |
| `.env` | **No** | Real local credentials. Ignored by `.gitignore`. |
| `.env.local` | **No** | Optional local overrides. Ignored by `.gitignore`. |
| `.env.example` | **Yes** | Placeholder values only. |

`.gitignore` rules:

```gitignore
.env
.env.*
.env.local
.env.*.local
!.env.example
```

The real password was removed from `.env.example` during this phase. Do not put
real credentials back into that file.

---

## 4. Install and run

```powershell
npm install
```

If `.env` does not exist, create it from the template and fill in the real local values:

```powershell
Copy-Item .env.example .env
```

Run the connection test:

```powershell
npm run db:test
```

The script is `scripts/test-db.ts`. It:

1. Imports the reusable pool from `src/lib/db.ts`.
2. Runs `SELECT DATABASE()`, `SELECT VERSION()`, and reads `@@lower_case_table_names`.
3. Lists base tables, views, estimated row counts, and foreign keys from
   `information_schema` using parameterized queries.
4. Checks that all 15 expected tables are present.
5. Releases the connection and closes the pool.
6. Prints `SUCCESS` / `PASSED` or `FAILED` and sets a non-zero exit code on failure.

Other verification commands:

```powershell
npm run typecheck
npm run build
```

---

## 5. Using the pool on the server

Import from `src/lib/db.ts` only in server-side code:

- Server Components
- Route Handlers (`app/**/route.ts`)
- Server Actions
- Backend service and repository modules
- Standalone scripts

Example query:

```ts
import { query, type SqlParam } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

type CampaignRow = RowDataPacket & {
  campaign_id: number;
  campaign_name: string;
  budget: string;
};

const params: SqlParam[] = ["Open", 20];
const campaigns = await query<CampaignRow[]>(
  `SELECT campaign_id, campaign_name, budget
   FROM campaigns
   WHERE status = ?
   LIMIT ?`,
  params,
);
```

Example mutation:

```ts
import { execute } from "@/lib/db";

const result = await execute(
  "INSERT INTO campaign_categories (category_name) VALUES (?)",
  ["Technology"],
);

console.log(result.insertId);
```

Example Route Handler:

```ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

export async function GET() {
  const rows = await query<RowDataPacket[]>(
    "SELECT campaign_id, campaign_name FROM campaigns WHERE status = ?",
    ["Open"],
  );

  return NextResponse.json({ data: rows });
}
```

Rules for future code:

- Always use `?` placeholders and pass values separately.
- Never concatenate user input into SQL.
- Dynamic identifiers, if ever needed, must come from a hard-coded allowlist.
- Do not import `src/lib/db.ts` in Client Components or middleware.
- Database routes must use the Node.js runtime, not Edge.
- Never return raw MySQL errors or connection details to the browser.

---

## 6. Verification results

All checks below were read-only.

| Check | Result |
| --- | --- |
| `SELECT DATABASE()` | `creatorconnect` |
| `SELECT VERSION()` | `8.0.46` |
| `@@lower_case_table_names` | `1` |
| Database character set | `utf8mb4` |
| Database collation | `utf8mb4_0900_ai_ci` |
| Base tables | **15** |
| Views | **1** (`campaign_creator_summary`) |
| Foreign keys | **15** |
| Triggers | **2** |
| Stored procedures | **1** (`get_campaign_creators`) |
| CHECK constraints | **18** |
| Exact row counts | All 15 tables report **0** rows |

### Base tables

| # | Table | Exact row count |
| --- | --- | --- |
| 1 | `users` | 0 |
| 2 | `creators` | 0 |
| 3 | `creator_social_accounts` | 0 |
| 4 | `brands` | 0 |
| 5 | `campaign_categories` | 0 |
| 6 | `campaigns` | 0 |
| 7 | `campaign_requirements` | 0 |
| 8 | `applications` | 0 |
| 9 | `collaborations` | 0 |
| 10 | `deliverables` | 0 |
| 11 | `content_submissions` | 0 |
| 12 | `contracts` | 0 |
| 13 | `payments` | 0 |
| 14 | `performance_metrics` | 0 |
| 15 | `reviews` | 0 |

The test script displays `information_schema.TABLES.TABLE_ROWS`, which is an
estimate for InnoDB. The table above uses exact `COUNT(*)` results from the
verification run.

### Foreign keys

All 15 foreign keys match the checked-in DDL names and targets:

| Child column | Parent column | Constraint | Delete rule |
| --- | --- | --- | --- |
| `applications.campaign_id` | `campaigns.campaign_id` | `fk_application_campaign` | CASCADE |
| `applications.creator_id` | `creators.creator_id` | `fk_application_creator` | CASCADE |
| `brands.user_id` | `users.user_id` | `fk_brand_user` | CASCADE |
| `campaign_requirements.campaign_id` | `campaigns.campaign_id` | `fk_requirement_campaign` | CASCADE |
| `campaigns.brand_id` | `brands.brand_id` | `fk_campaign_brand` | CASCADE |
| `campaigns.category_id` | `campaign_categories.category_id` | `fk_campaign_category` | SET NULL |
| `collaborations.application_id` | `applications.application_id` | `fk_collaboration_application` | CASCADE |
| `content_submissions.deliverable_id` | `deliverables.deliverable_id` | `fk_submission_deliverable` | CASCADE |
| `contracts.collaboration_id` | `collaborations.collaboration_id` | `fk_contract_collaboration` | CASCADE |
| `creator_social_accounts.creator_id` | `creators.creator_id` | `fk_social_creator` | CASCADE |
| `creators.user_id` | `users.user_id` | `fk_creator_user` | CASCADE |
| `deliverables.collaboration_id` | `collaborations.collaboration_id` | `fk_deliverable_collaboration` | CASCADE |
| `payments.collaboration_id` | `collaborations.collaboration_id` | `fk_payment_collaboration` | CASCADE |
| `performance_metrics.collaboration_id` | `collaborations.collaboration_id` | `fk_metrics_collaboration` | CASCADE |
| `reviews.collaboration_id` | `collaborations.collaboration_id` | `fk_review_collaboration` | CASCADE |

All update rules are `CASCADE`.

### Other database objects

- `update_collaboration_after_payment` - `AFTER UPDATE` trigger on `payments`.
- `complete_collaboration_after_payment_insert` - `AFTER INSERT` trigger on `payments`.
- `get_campaign_creators` - stored procedure.
- `campaign_creator_summary` - view.

Both triggers, the procedure, and the view match the checked-in DDL definitions.

---

## 7. Schema comparison: live database versus checked-in DDL

The live schema is close to `DDL STATEMENTS.sql`. The earlier
`docs/SCHEMA_VERIFICATION.md` was based on 2026-08-28 screenshots and is now
historical: the live schema has since been migrated and matches the newer DDL.

### Differences found

| Object | Live database | Checked-in DDL | Action taken |
| --- | --- | --- | --- |
| `creators.profile_picture` | `VARCHAR(255) NULL` | Not defined | Documented only; not removed |
| `campaigns.max_creators` | `INT NULL DEFAULT 1` | Not defined | Documented only; not removed |
| `campaigns.chk_max_creators` | `CHECK (max_creators > 0)` | Not defined | Documented only; not removed |

These are additive/legacy columns. The DDL adds `creators.profile_picture_url` and
`campaigns.creator_limit`, and both of those also exist live. The live database
therefore contains both the older and newer variants. No columns, constraints,
indexes, or rows were changed during this phase.

### Previously reported differences that are resolved

| Area | Live database now | DDL | Screenshot report |
| --- | --- | --- | --- |
| `creators` phone/address | `phone`, `address` | Matches | Reported `phone_no`, `street` |
| `creators` extra fields | No `middle_name`, no `zip` | Matches | Reported `middle_name`, `zip` |
| `brands` columns/lengths | `contact_number`, `address`, `city(100)`, `state(100)` | Matches | Reported smaller/different columns |
| `campaigns.category_id` | Nullable | Matches | Reported `NOT NULL` |
| `campaigns` capacity | `max_creators` and `creator_limit` | Only `creator_limit` | Reported only `max_creators` |
| `contracts.contract_document` | Present | Present | Reported absent |
| `payments.transaction_reference` | Present | Present | Reported absent |
| `deliverables` nullability | `content_type` and `due_date` are `NOT NULL` | Matches | Reported nullable |
| `reviews.rating` | `NOT NULL` | Matches | Reported nullable |

The live database is the source of truth for future application code. Do not run
the DDL file and do not "fix" the live schema to match the screenshots.

---

## 8. Security notes

- `.env` and `.env.local` are ignored by Git.
- `.env.example` contains placeholders only.
- No credential is hard-coded in `src/lib/db.ts` or `scripts/test-db.ts`.
- No database access is exposed to the frontend.
- All metadata reads in the test use `?` placeholders.
- Error output does not print passwords.
- The current local configuration uses the MySQL `root` account. For deployment,
  create a dedicated application user with only the privileges the application
  needs.

---

## 9. Issues encountered and resolution

| Issue | Resolution |
| --- | --- |
| `.env` was absent when the task started, despite being described as configured. | Created a local `.env` from `.env.example` before sanitizing the example, then verified the new `.env` is ignored by Git. |
| `.env.example` contained a real password. | Replaced it with `your_mysql_user` / `your_mysql_password`. |
| `mysql2` typing rejected generic parameter arrays. | Added an explicit `SqlParam` union used by `query()` and `execute()`. |
| Next.js warned about a parent-directory lockfile. | Set `turbopack.root` to the project directory in `next.config.ts`. |
| No application code or package manager existed. | Created a minimal Next.js App Router TypeScript skeleton and installed `mysql2`, `tsx`, and standard type packages. No application features were added. |
