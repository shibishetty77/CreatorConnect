# CreatorConnect - Implementation Plan

**Project:** Creator & Brand Sponsorship Collaboration Platform  
**Database:** `creatorconnect` (MySQL 8.0+)  
**Stage:** Planning only. No application code has been written yet.  
**Last updated:** 2026-10-27

---

## Status and evidence rules

This plan separates evidence into three levels:

| Level | Meaning |
| --- | --- |
| **Verified** | Directly inspected in the repository or local environment. |
| **Observed** | Visible in the dated schema screenshots in `PICS/`, but not confirmed against the live server. |
| **Unverified** | Requires live MySQL access or implementation work before it can be claimed as working. |

**Critical warning:** `DDL STATEMENTS.sql` starts with `DROP DATABASE IF EXISTS creatorconnect;`. It must never be executed against the existing database. It also does not match the schema captured in `PICS/`. The live database is the source of truth, not the SQL file.

---

## 1. Repository assessment

### 1.1 Inventory

| Path | Finding |
| --- | --- |
| `README.md` | UTF-16 file, 38 bytes, contains only the title `CreatorConnect`. No setup or run instructions. |
| `DDL STATEMENTS.sql` | 16,432 bytes, 769 lines, last modified 2026-10-04. Contains 15 tables, ALTERs, indexes, two payment triggers, `get_campaign_creators` procedure, and `campaign_creator_summary` view. It is **destructive at the top** and is newer than the captured live schema. |
| `g11.pdf` | 537,600-byte project report. Text extraction shows title, ER diagram, relational schema, and DDL appendix; no application source code. |
| `PICS/` | 8 MySQL console screenshots dated 2026-08-28 showing the actual `creatorconnect` tables, plus 2 generated ER diagrams. |
| `DBMS MINI - Copy/` | Outside the git workspace. Contains an older 404-line DDL that matches the 2026-08-28 screenshots much more closely. It has no triggers, procedure, or view. |
| Source code | None. No `package.json`, `src/`, `app/`, `pages/`, environment files, lockfiles, tests, or CI configuration. |
| Git | Branch `main`, tracking `origin/main`, one commit (`7893072 first commit`) containing only the UTF-16 README. `DDL STATEMENTS.sql`, `PICS/`, and `g11.pdf` are untracked. |
| Runtime | Node.js `v24.4.1`, npm `11.4.2`. |
| MySQL | Windows service `MySQL80` is running. MySQL binaries are at `C:\Program Files\MySQL\MySQL Server 8.0\bin`; `mysql` is not on `PATH`. Server version reported by Workbench: `8.0.46`. `lower_case_table_names=1` is configured, so table names are stored lowercase. |
| Credentials | Not available yet. `mysql -u root` without a password returns `ERROR 1045`. No `.env` file exists. |

### 1.2 Existing features

There is no application to preserve. The only existing artifacts are the database design, report, screenshots, and DDL. The implementation therefore starts from a greenfield Next.js codebase while preserving:

- Database name `creatorconnect`.
- The existing 15-table relational model.
- Role names `Admin`, `Brand`, `Creator`.
- Existing enum values, foreign keys, indexes, and any live database objects.
- The project's ER model and domain vocabulary.
- No destructive reset or reseeding of the existing database.

### 1.3 Repository risks found during inspection

1. The checked-in DDL is not the same schema as the screenshots. Building from the file without live verification would create runtime failures.
2. The checked-in DDL's first statement would destroy the existing database if someone "helpfully" runs it.
3. The older DDL copy outside the repository has no triggers, procedure, or view. The screenshot session proves tables, not database objects.
4. The live credentials are absent, so neither the server schema nor the data volume can be verified yet.
5. The README is UTF-16 and unhelpful; setup documentation will need to be added.

---

## 2. Existing database schema assessment

### 2.1 Verification status

**Not yet verified against the live database.** The following assessment is based on:

- The current `DDL STATEMENTS.sql` (newer, contains triggers/procedure/view).
- The 2026-08-28 screenshots (older live snapshot).
- The older DDL copy (consistent with most of the screenshots).

The screenshots are evidence of the live database at that time, not a guarantee of its current state. The first implementation gate is a read-only live-schema inspection.

### 2.2 Shape observed in the 2026-08-28 screenshots

These are the table shapes visible in `PICS/`, listed in `SHOW TABLES` order. Column names are lowercase because of `lower_case_table_names=1`.

```
users
  user_id, username, email, password_hash, role, created_at

creators
  creator_id, user_id, first_name, middle_name, last_name, date_of_birth,
  phone_no, bio, street, city, state, zip, profile_picture

creator_social_accounts
  account_id, creator_id, platform, username, followers,
  engagement_rate, account_url

brands
  brand_id, user_id, brand_name, industry, contact_person, phone_no,
  street, city, state, zip

campaign_categories
  category_id, category_name

campaigns
  campaign_id, brand_id, category_id, campaign_name, description, budget,
  min_followers, start_date, end_date, status, max_creators

campaign_requirements
  requirement_id, campaign_id, platform, required_niche, min_engagement_rate

applications
  application_id, campaign_id, creator_id, applied_date, status

collaborations
  collaboration_id, application_id, agreed_amount, start_date, end_date, status

deliverables
  deliverable_id, collaboration_id, content_type, due_date, status

content_submissions
  submission_id, deliverable_id, content_url, submitted_date, approval_status

contracts
  contract_id, collaboration_id, signed_date, expiry_date

payments
  payment_id, collaboration_id, amount, payment_date, status

performance_metrics
  metric_id, collaboration_id, views, likes, comments, shares, clicks

reviews
  review_id, collaboration_id, rating, feedback, review_date
```

### 2.3 DDL file versus observed live schema

| Area | Current `DDL STATEMENTS.sql` | Observed in 2026-08-28 screenshots | Impact |
| --- | --- | --- | --- |
| `creators` identity | `phone`, `address`, `profile_picture_url` | `middle_name`, `date_of_birth`, `phone_no`, `street`, `zip`, `profile_picture` | Form fields, SELECT lists, and INSERT/UPDATE statements must follow the live names. |
| `creators.date_of_birth` | Nullable | Screenshot shows `NOT NULL` | Registration must require a date of birth if confirmed. |
| `creator_social_accounts.followers` | `BIGINT` | `INT` | Use integer range validation; do not claim bigint support. |
| `creator_social_accounts.engagement_rate` | Default `0.00` | Default appears `NULL` | Treat as nullable on read; require a value on write if the UI needs it. |
| `brands` | `brand_name(150)`, `industry(100)`, `contact_number`, `address`, `city(100)`, `state(100)` | `brand_name(100)`, `industry(50)`, `contact_person`, `phone_no`, `street`, `city(50)`, `state(50)`, `zip` | Field names and max lengths differ. |
| `campaign_categories` | Has `description` | Only `category_id`, `category_name` | Do not select `description` unless live verification finds it. |
| `campaigns.category_id` | Nullable | `NOT NULL` | Campaign creation must require a category. |
| `campaigns.campaign_name` | `VARCHAR(150)` | `VARCHAR(100)` | Validate to the smaller observed length until verified. |
| `campaigns.min_followers` | `BIGINT` | `INT` | Validate as a 32-bit integer. |
| `campaigns.start_date/end_date` | `NOT NULL` | Nullable | Application-level validation must require valid dates for publishing. |
| Campaign capacity | `creator_limit` via ALTER | `max_creators` default 10 | The application must read the correct column from the verified schema. |
| `campaign_requirements.platform` | `NOT NULL` | Nullable | The UI should require a platform; reads must tolerate null. |
| `campaign_requirements.required_niche` | `VARCHAR(100)` | `VARCHAR(50)` | Validate to 50 unless verified otherwise. |
| `collaborations.agreed_amount` | `NOT NULL` | Nullable | Validate amount on accept; reads should tolerate null. |
| `deliverables.content_type/due_date` | `NOT NULL` | Nullable | Validate on write; reads should tolerate null. |
| `content_submissions.content_url` | `VARCHAR(500) NOT NULL` | `VARCHAR(255)` nullable | Use 255 and require a value on write until verified. |
| `contracts.contract_document` | Exists | Absent | No document URL can be stored on the observed schema. |
| `payments.transaction_reference` | Exists | Absent | No transaction reference can be stored on the observed schema. |
| `performance_metrics` values | `BIGINT` | `INT` | Validate as 32-bit non-negative integers. |
| `reviews.rating` | `NOT NULL` | Nullable | Validate 1-5 on write; tolerate null on read. |
| Triggers | Two payment triggers defined | Not visible in screenshots | Must verify with `SHOW TRIGGERS`. |
| Procedure | `get_campaign_creators` | Not visible in screenshots | Must verify with `SHOW PROCEDURE STATUS`. |
| View | `campaign_creator_summary` | Not visible in screenshots | Must verify with `SHOW FULL TABLES`. |
| Indexes | Explicit list | Some key markers visible, not complete | Verify with `SHOW INDEX`; do not assume index names. |
| Cleanup rules | Many `ON DELETE CASCADE` clauses | Not fully visible | Verify actual FK actions; do not assume cascades. |

### 2.4 Business rules encoded (or not encoded) in the schema

- `users` has unique `username` and `email`, roles constrained by enum, and a password hash.
- One creator profile and one brand profile per user (`UNIQUE user_id`).
- Campaigns belong to one brand and one category; requirements belong to campaigns.
- Applications are unique per `(campaign_id, creator_id)` according to the checked-in DDL; live unique constraints must be verified.
- One collaboration per accepted application (`application_id UNIQUE`).
- One contract, one metrics row, and one review per collaboration (`UNIQUE collaboration_id`).
- Multiple payments per collaboration are allowed.
- Multiple deliverables per collaboration and multiple submissions per deliverable are allowed.
- Campaign capacity is represented by `creator_limit` or `max_creators`; accepting applications beyond capacity must be blocked in application code.
- Two triggers mark a collaboration `Completed` when a payment becomes `Paid`. This has important consequences:
  - A **partial** payment marked `Paid` completes the whole collaboration.
  - Any later `Pending` payment does not reopen it.
  - The application must treat payment as full settlement, or the schema needs an additive migration; this cannot be silently ignored.
- The `Reviews` table has no reviewer identity. The observed schema cannot tell whether a brand or creator wrote a review. The plan proposes brand-authored reviews of creators, with this limitation documented.
- There is no creator niche field. `campaign_requirements.required_niche` cannot be matched reliably against creator data.
- There is no campaign draft/published column. The available statuses are only `Open`, `Ongoing`, `Completed`.

### 2.5 Read-only verification to run before implementation

After credentials are supplied, run these against the live server and save the output (redacting secrets) as `docs/SCHEMA_VERIFICATION.md`:

```sql
SELECT VERSION(), @@lower_case_table_names, @@character_set_database, @@collation_database;

USE creatorconnect;

SHOW TABLES;

SHOW CREATE TABLE users;
SHOW CREATE TABLE creators;
SHOW CREATE TABLE creator_social_accounts;
SHOW CREATE TABLE brands;
SHOW CREATE TABLE campaign_categories;
SHOW CREATE TABLE campaigns;
SHOW CREATE TABLE campaign_requirements;
SHOW CREATE TABLE applications;
SHOW CREATE TABLE collaborations;
SHOW CREATE TABLE deliverables;
SHOW CREATE TABLE content_submissions;
SHOW CREATE TABLE contracts;
SHOW CREATE TABLE payments;
SHOW CREATE TABLE performance_metrics;
SHOW CREATE TABLE reviews;

SHOW TRIGGERS;
SHOW PROCEDURE STATUS WHERE Db = 'creatorconnect';
SHOW FULL TABLES WHERE Table_type = 'VIEW';

SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE, IS_NULLABLE,
       COLUMN_DEFAULT, COLUMN_KEY, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'creatorconnect'
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'creatorconnect'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = 'creatorconnect';

SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME,
       REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'creatorconnect'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

SELECT COUNT(*) AS users FROM users;
SELECT COUNT(*) AS creators FROM creators;
SELECT COUNT(*) AS brands FROM brands;
SELECT COUNT(*) AS campaigns FROM campaigns;
SELECT COUNT(*) AS applications FROM applications;
SELECT COUNT(*) AS collaborations FROM collaborations;
SELECT COUNT(*) AS payments FROM payments;
```

Do not run `DDL STATEMENTS.sql`, `DROP DATABASE`, `TRUNCATE`, or migration commands against `creatorconnect`.

### 2.6 Schema capability map

Once verified, record a small capability map in code (for example `src/lib/db/schema.ts`) rather than scattering conditional column names through pages:

| Capability | Values | Used by |
| --- | --- | --- |
| Campaign capacity column | `max_creators` or `creator_limit` | Campaign create/edit, application acceptance |
| Creator phone column | `phone_no` or `phone` | Creator profile |
| Creator address columns | `street`/`zip` or `address` | Creator profile |
| Creator picture column | `profile_picture` or `profile_picture_url` | Creator profile, avatars |
| Brand phone/address columns | `phone_no`/`street`/`zip` or `contact_number`/`address` | Brand profile |
| Category description | present / absent | Category admin form |
| Contract document | present / absent | Contract form and printable view |
| Payment reference | present / absent | Payment form |
| Payment triggers | present / absent | Payment service behavior |
| Procedure/view | present / absent | Admin reporting page |

The map is generated from a single verification result, not from guesses at runtime.

---

## 3. Proposed application architecture

### 3.1 High-level shape

```text
Browser
  |
  | HTTPS, HttpOnly signed session cookie
  v
Next.js App Router (Node.js runtime)
  |-- Server Components: read pages, layouts, dashboards
  |-- Route Handlers: validated mutations and filtered API reads
  |-- Middleware: session presence + role gate for route groups
  |
  |-- Zod validation
  |-- Authorization and ownership checks
  |-- Service layer: business rules and transactions
  |-- Repository layer: parameterized SQL, row mapping
  |
  v
mysql2/promise connection pool
  |
  v
MySQL 8.0 database `creatorconnect`
  |-- 15 tables
  |-- indexes, checks, foreign keys
  |-- payment triggers
  |-- get_campaign_creators procedure
  |-- campaign_creator_summary view
```

### 3.2 Stack decisions

| Concern | Decision | Rationale |
| --- | --- | --- |
| Framework | Next.js (latest stable, App Router) + React + TypeScript strict | Required. Server Components reduce client-side data fetching and keep database access server-only. |
| Styling | Tailwind CSS v4 with CSS variables and internal UI primitives | Required; avoids a heavy component library while keeping a consistent design system. |
| Database | MySQL 8.0.46, existing `creatorconnect` | Required. |
| Data access | `mysql2/promise` with a typed repository layer and parameterized queries | **Selected over Prisma.** See section 5.1. |
| Validation | Zod schemas shared by forms and route handlers | Required. Server-side validation is the authority. |
| Password hashing | `bcryptjs` | Pure JavaScript; avoids native build issues on Windows; configurable cost. |
| Sessions | Signed JWT in an HttpOnly cookie, verified with `jose` | No sessions table exists; avoids an unrequested schema addition. |
| UI icons | `lucide-react` | Small, accessible, consistent icon set. |
| Class utilities | `clsx` + `tailwind-merge` | Standard, minimal. |
| Dates | Native `Intl.DateTimeFormat`; small date helpers where arithmetic is needed | MySQL `DATE` values do not need a heavy date library. |
| Charts | Accessible SVG/CSS visualizations plus data tables | Avoids a chart dependency; dashboards still communicate real aggregates. |
| Tests | Vitest for unit/integration, Playwright for end-to-end | Practical coverage for validation, database behavior, and role flows. |
| Quality | ESLint, TypeScript `--noEmit`, `next build` | Verification gates. |

### 3.3 Request and data flow

1. A page is rendered as a Server Component. It calls `getCurrentUser()` (React-cached per request), checks role/ownership, then calls a repository directly. No browser-side database access.
2. A mutation form posts JSON to a Route Handler.
3. The route handler:
   - verifies the session and role;
   - parses the body with a Zod schema;
   - checks resource ownership (for example, brand owns campaign);
   - calls a service function that owns the business transaction;
   - maps database errors to safe API errors;
   - returns `{ data }` or `{ error }`.
4. The client shows field errors or success, then calls `router.refresh()` or navigates.
5. Sensitive reads never expose password hashes, internal SQL errors, or other users' private data.

### 3.4 Deployment assumptions

- Node.js runtime for all routes that touch MySQL. No database access from Edge runtime.
- Middleware uses `jose` only (Edge-compatible) and must not import `mysql2` or `bcryptjs`.
- Environment variables are validated at startup for server code. Public variables are limited to non-secrets.
- The app runs locally against MySQL on `localhost:3306` by default. Production can supply a different host/port via env.

### 3.5 Security posture

- All SQL uses placeholders. Dynamic SQL is limited to whitelisted sort columns and integer-validated pagination values.
- Authorization is enforced in three places: middleware route gates, server page/layout guards, and service-level ownership checks. Role alone is never sufficient.
- Session cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production, with a 7-day expiry.
- Mutating requests validate the `Origin`/`Host` pair as CSRF defense in depth.
- Login is rate-limited (in-memory for a single instance; documented as a deployment limitation).
- Password hashes never leave the server.
- URLs supplied by users (`account_url`, `content_url`, profile picture) are validated and rendered as text/href with safe protocols.
- Admin accounts are not publicly self-registerable.

---

## 4. Folder and module structure

```text
creatorconnect/
  middleware.ts                          # session + role route gate
  next.config.ts
  tsconfig.json
  eslint.config.mjs
  postcss.config.mjs
  package.json
  .env.example
  .env.local                            # git-ignored, real credentials
  README.md
  docs/
    IMPLEMENTATION_PLAN.md
    SCHEMA_VERIFICATION.md              # created after live verification
  scripts/
    verify-db.ts                        # read-only schema/object report
    seed-admin.ts                       # idempotent admin bootstrap
    seed-categories.ts                  # optional real category setup
  src/
    app/
      layout.tsx
      page.tsx                          # public landing
      globals.css
      not-found.tsx
      error.tsx
      unauthorized/page.tsx

      (auth)/
        login/page.tsx
        register/page.tsx

      (public)/
        campaigns/page.tsx
        campaigns/[campaignId]/page.tsx
        creators/[creatorId]/page.tsx
        brands/[brandId]/page.tsx

      creator/
        layout.tsx                      # creator role guard
        page.tsx                        # dashboard
        profile/page.tsx
        social-accounts/page.tsx        # optional page; can live in profile
        campaigns/page.tsx
        campaigns/[campaignId]/page.tsx
        applications/page.tsx
        applications/[applicationId]/page.tsx
        collaborations/page.tsx
        collaborations/[collaborationId]/page.tsx
        payments/page.tsx
        reviews/page.tsx

      brand/
        layout.tsx                      # brand role guard
        page.tsx                        # dashboard
        profile/page.tsx
        campaigns/page.tsx
        campaigns/new/page.tsx
        campaigns/[campaignId]/page.tsx
        campaigns/[campaignId]/edit/page.tsx
        campaigns/[campaignId]/applications/page.tsx
        collaborations/page.tsx
        collaborations/[collaborationId]/page.tsx
        creators/page.tsx
        creators/[creatorId]/page.tsx
        payments/page.tsx

      admin/
        layout.tsx                      # admin role guard
        page.tsx                        # dashboard
        users/page.tsx
        users/[userId]/page.tsx
        creators/page.tsx
        brands/page.tsx
        campaigns/page.tsx
        campaigns/[campaignId]/page.tsx
        categories/page.tsx
        collaborations/page.tsx
        collaborations/[collaborationId]/page.tsx
        payments/page.tsx
        reviews/page.tsx
        reports/page.tsx
        system/page.tsx                 # read-only DB object status

      api/
        auth/register/route.ts
        auth/login/route.ts
        auth/logout/route.ts
        auth/session/route.ts
        health/route.ts
        creator/profile/route.ts
        creator/social-accounts/route.ts
        creator/social-accounts/[accountId]/route.ts
        creator/campaigns/[campaignId]/applications/route.ts
        creator/applications/route.ts
        brand/profile/route.ts
        brand/campaigns/route.ts
        brand/campaigns/[campaignId]/route.ts
        brand/campaigns/[campaignId]/status/route.ts
        brand/campaigns/[campaignId]/applications/route.ts
        applications/[applicationId]/accept/route.ts
        applications/[applicationId]/reject/route.ts
        collaborations/[collaborationId]/route.ts
        collaborations/[collaborationId]/deliverables/route.ts
        collaborations/[collaborationId]/contract/route.ts
        collaborations/[collaborationId]/payments/route.ts
        collaborations/[collaborationId]/metrics/route.ts
        collaborations/[collaborationId]/review/route.ts
        deliverables/[deliverableId]/route.ts
        deliverables/[deliverableId]/submissions/route.ts
        submissions/[submissionId]/review/route.ts
        payments/[paymentId]/route.ts
        reviews/[reviewId]/route.ts
        admin/categories/route.ts
        admin/categories/[categoryId]/route.ts
        admin/campaigns/[campaignId]/status/route.ts
        admin/reports/overview/route.ts
        admin/reports/campaigns/[campaignId]/route.ts
        admin/system/db/route.ts

    components/
      ui/                               # Button, Input, Select, Textarea, Card, Badge,
                                        # Dialog, Table, Tabs, Alert, EmptyState,
                                        # Pagination, Stat, Avatar, Skeleton
      layout/                           # AppShell, Sidebar, Topbar, RoleNav, Footer
      campaigns/                        # CampaignCard, CampaignForm, FilterBar, RequirementEditor
      applications/                     # ApplicationRow, AcceptDialog, StatusBadge
      collaborations/                   # Timeline, DeliverableList, SubmissionReview, ContractPanel
      payments/                         # PaymentTable, PaymentForm, PaymentStatus
      metrics/                          # MetricCards, BarComparison, Funnel
      reviews/                          # RatingStars, ReviewForm
      admin/                            # DataTable, ReportFilters, SystemObjectTable
      forms/                            # FormField, FormError, SubmitButton

    lib/
      db/
        pool.ts                         # singleton mysql2 pool
        transaction.ts                  # BEGIN/COMMIT/ROLLBACK helper
        errors.ts                       # MySQL error mapping
        schema.ts                       # verified capability map
        types.ts                        # row and domain types
        sql.ts                          # safe pagination/sort helpers
      auth/
        session.ts                      # sign/verify cookie, getCurrentUser
        password.ts                     # hash/verify
        guards.ts                       # requireUser, requireRole, ownership assertions
        csrf.ts                         # origin check
        rate-limit.ts                   # login throttling
      validation/
        auth.ts
        profiles.ts
        campaigns.ts
        applications.ts
        collaborations.ts
        payments.ts
        metrics.ts
        reviews.ts
        admin.ts
        common.ts                       # ids, dates, money, URLs, pagination
      repositories/
        users.ts
        creators.ts
        brands.ts
        social-accounts.ts
        categories.ts
        campaigns.ts
        applications.ts
        collaborations.ts
        deliverables.ts
        submissions.ts
        contracts.ts
        payments.ts
        metrics.ts
        reviews.ts
        reports.ts
      services/
        auth.service.ts
        profile.service.ts
        campaign.service.ts
        application.service.ts
        collaboration.service.ts
        delivery.service.ts
        payment.service.ts
        review.service.ts
        admin.service.ts
      format/
        currency.ts
        date.ts
        number.ts
        text.ts
      constants.ts                      # platforms, roles, statuses, page sizes
    types/
      domain.ts
      api.ts
  tests/
    unit/
    integration/
    e2e/
```

### 4.1 Module boundaries

- `app/` contains routing, layouts, page composition, and HTTP concerns only.
- `components/` contains reusable presentation and form components.
- `services/` owns multi-step business operations and transactions (accept application, submit content, mark payment paid).
- `repositories/` owns SQL and row mapping for one aggregate each.
- `lib/auth` owns identity, session, and authorization.
- `lib/validation` owns Zod schemas; no route handler defines ad-hoc validation.
- `lib/db` owns the pool, error mapping, and the verified schema capability map.
- Tests import services and repositories directly; they do not duplicate SQL in tests.

---

## 5. Database integration strategy

### 5.1 Prisma versus mysql2

**Decision: use `mysql2/promise` with a typed repository layer.**

Prisma was evaluated first, as requested. It can map the 15 tables and is a reasonable ORM for a new schema, but it is not the safest choice for this specific database:

1. **Schema drift:** the checked-in DDL does not match the live snapshot. Prisma would require `prisma db pull` against the live database, creating a second schema definition that can drift from `DDL STATEMENTS.sql` again.
2. **Database objects:** the stored procedure and view still require raw SQL. Prisma does not model them as first-class application models.
3. **Transactions and locks:** accepting an application must lock the campaign row and enforce capacity. This is clearer with explicit `SELECT ... FOR UPDATE` and a `mysql2` transaction.
4. **Triggers:** payment triggers change collaboration state outside the ORM. The service must re-read state after payment writes regardless of ORM.
5. **No migrations:** this project must not use migrations or reset the existing database. Prisma's migration workflow is deliberately avoided, so much of its value is reduced.
6. **Error fidelity:** `mysql2` exposes MySQL error codes (`ER_DUP_ENTRY`, check-constraint errors), which map cleanly to API responses.

`mysql2` does not remove type safety: all rows are mapped into explicit TypeScript types, all inputs are Zod-validated, and all values are bound with placeholders. Dynamic identifiers (sort columns, pagination) are whitelisted/validated, never interpolated from raw user input.

If the team later prefers Prisma, it can be introduced for table CRUD without changing the HTTP/service boundaries, but it should not be introduced before the live schema is verified.

### 5.2 Connection configuration

`.env.example`:

```dotenv
# Server-only. Never commit real values.
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=creatorconnect_app
DB_PASSWORD=
DB_NAME=creatorconnect

AUTH_SECRET=
APP_TIMEZONE=Asia/Kolkata
APP_CURRENCY=INR
```

- `lib/db/pool.ts` imports `server-only`, parses environment variables with Zod, and creates one `mysql2/promise` pool per process.
- Pool options: `waitForConnections: true`, `connectionLimit: 10`, `queueLimit: 0`, `charset: 'utf8mb4'`, `timezone: 'Z'`, `dateStrings: true`, `decimalNumbers: false`.
- `dateStrings: true` prevents timezone shifts for MySQL `DATE` values; format them explicitly for display.
- `decimalNumbers: false` keeps `DECIMAL` values as strings so money is not silently rounded through JavaScript `number`; convert only at the display boundary.
- A health check runs `SELECT 1` and reports only a safe status.
- The app uses a least-privilege MySQL user with `SELECT, INSERT, UPDATE, DELETE` on `creatorconnect` and no `DROP`/`ALTER`/`GRANT` privileges. The admin verification script may use a separate read-only account.

### 5.3 Query and transaction rules

- Every query uses `pool.execute(sql, params)` or a checked-out connection's `execute`.
- `withTransaction` always uses `BEGIN`, `COMMIT`, and `ROLLBACK` in a `try/finally`; connections are always released.
- Application acceptance transaction:
  1. `SELECT` campaign `FOR UPDATE`.
  2. Verify brand ownership and campaign status.
  3. Count accepted applications / existing collaborations.
  4. Verify capacity using the verified capacity column.
  5. Re-check the application is `Pending`.
  6. `UPDATE applications SET status='Accepted'`.
  7. `INSERT INTO collaborations ...`.
  8. Commit.
- Creator application transaction:
  1. Lock the campaign row (`FOR UPDATE`).
  2. Verify status is `Open`, dates are valid, and capacity is not exceeded.
  3. Verify no existing application (also rely on the unique constraint).
  4. Verify creator eligibility (platform/followers/engagement).
  5. Insert.
  6. Commit.
- Deliverable completion: approving a submission and marking its deliverable `Completed` happens in one transaction.
- Payment writes: after changing a payment to `Paid`, re-read the collaboration because the database trigger may have changed its status to `Completed`. The UI must show that consequence.
- Review and metrics upserts use `INSERT ... ON DUPLICATE KEY UPDATE` because both are unique per collaboration.
- Reads that join multiple tables use explicit aliases and select only needed columns. No `SELECT *` in application code.

### 5.4 Error mapping

| MySQL error | HTTP response | User-facing behavior |
| --- | --- | --- |
| `ER_DUP_ENTRY` | 409 | "That email/username/application already exists." Map by constraint/index name where possible. |
| `ER_NO_REFERENCED_ROW_2` | 400 | "The selected record no longer exists." |
| `ER_ROW_IS_REFERENCED_2` | 409 | "This record is in use and cannot be removed." |
| `ER_DATA_TOO_LONG` | 400 | Field-level "too long" error. |
| Check constraint violation (`3819`) | 400 | Generic validation message; log constraint name. |
| `ER_LOCK_DEADLOCK` / timeout | 503/409 | "Please retry." Log for investigation. |
| Unknown error | 500 | Generic message; no SQL or stack trace in the response. |

### 5.5 Schema verification and database-object policy

- The first step after credentials are received is the read-only verification in section 2.5.
- `docs/SCHEMA_VERIFICATION.md` records the exact live columns, keys, checks, triggers, procedure, view, and row counts.
- `src/lib/db/schema.ts` stores only the capability map needed by the application.
- If the triggers, procedure, or view are missing:
  - The application's own SQL implements equivalent behavior so core workflows still work.
  - The admin system page marks the object as missing.
  - Creating the missing database objects is an additive change and requires explicit approval. It will not be done silently.
- If the live schema is missing a field the UI needs (see blockers), the application will not pretend the feature exists. It will either omit the feature or use an approved additive migration.

### 5.6 No migration/reset policy

- No `prisma migrate`, `db push`, `DROP DATABASE`, `TRUNCATE`, or automatic seeding against `creatorconnect`.
- Schema changes, if approved, are small, additive, and documented as SQL files under `db/migrations/` with a rollback note.
- The app must run against the existing schema. It does not own the database lifecycle.
- Seed scripts are idempotent and limited to explicit configuration data:
  - `seed-admin.ts`: creates/updates one admin user from environment variables (email/username/password), using a transaction and hash.
  - `seed-categories.ts`: optional initial category list; does not create campaigns, creators, brands, payments, or reviews.
- No mock campaigns, applications, or payments in the production database. Empty states are real UI states.

### 5.7 Test database

- Integration tests use a separate database named `creatorconnect_test` (or a Docker MySQL instance), never `creatorconnect`.
- The test bootstrap refuses to run unless `DB_NAME` ends with `_test`.
- The test schema can be created from a schema-only dump of the verified live database (`mysqldump --no-data`) or from a dedicated test DDL.
- Test data is created and removed inside the test database; it is not "mock UI data" and is never copied into production.

---

## 6. Authentication and authorization design

### 6.1 Session model

- On successful login/registration, the server issues a signed JWT (`HS256`) with:
  - `sub`: `user_id`
  - `role`
  - `username`
  - `iat`, `exp` (7 days)
- The token is stored in `cc_session`:
  - `HttpOnly`
  - `SameSite=Lax`
  - `Secure` in production
  - `Path=/`
- `AUTH_SECRET` must be at least 32 random bytes; startup validation fails without it.
- Logout clears the cookie. Because there is no sessions table, logout cannot revoke an already-stolen token server-side; this is an accepted limitation for the project and must be documented. Sensitive operations re-check the user and role in the database.
- `getCurrentUser()` verifies the JWT, loads the user and profile identity from MySQL, and returns `null` if the account no longer exists. It is wrapped in React `cache` so a page performs one lookup per request.

### 6.2 Registration

- Public registration supports only `Creator` and `Brand`. Admin accounts are provisioned by `seed-admin.ts` and are never self-registered.
- Required user fields: username, email, password, role.
- Creator profile fields (subject to live verification): first name, middle name (optional), last name, date of birth, phone, bio, street, city, state, zip, profile picture URL.
- Brand profile fields: brand name, industry, contact person, phone, street, city, state, zip.
- Registration creates the `users` row and the role profile in one transaction.
- Duplicate email/username returns a field-level 409, not a generic failure.
- Password rules: minimum 8 characters, maximum 72 bytes (bcrypt), at least one letter and one number. Password confirmation is checked server-side.
- On success, a session is created and the user is redirected to the role dashboard. Optional email verification is out of scope because the schema has no verification columns.

### 6.3 Login

- Identifier can be email or username.
- Lookup is parameterized and case handling follows the database collation; email normalization is applied consistently.
- Wrong identifier and wrong password return the same generic message.
- Failed attempts are rate-limited per IP + identifier (for example 5 attempts per 15 minutes). The limiter is process-local; a multi-instance deployment would need Redis or a database-backed limiter.
- A successful login always re-reads the role from the database, not from client input.

### 6.4 Route protection

| Route group | Unauthenticated | Creator | Brand | Admin |
| --- | --- | --- | --- | --- |
| `/`, `/campaigns`, `/creators/[id]`, `/brands/[id]` | Allowed | Allowed | Allowed | Allowed |
| `/login`, `/register` | Allowed | Redirect to dashboard | Redirect to dashboard | Redirect to dashboard |
| `/creator/**` | Redirect to login | Allowed | 403 | 403 |
| `/brand/**` | Redirect to login | 403 | Allowed | 403 |
| `/admin/**` | Redirect to login | 403 | 403 | Allowed |
| `/api/auth/login`, `/register` | Allowed | Allowed | Allowed | Allowed |
| `/api/creator/**` | 401 | Allowed | 403 | 403 |
| `/api/brand/**` | 401 | 403 | Allowed | 403 |
| `/api/admin/**` | 401 | 403 | 403 | Allowed |
| `/api/collaborations/**` | 401 | Own parties only | Own parties only | All |
| `/api/health` | Allowed (safe status only) | Allowed | Allowed | Allowed |

Middleware enforces the coarse route gate. Every page and service repeats the check and adds resource ownership checks. A 403 page is used for authenticated-but-forbidden access; unauthenticated users are redirected to login with a `next` parameter.

### 6.5 Ownership and resource checks

- Brand may read/update/delete only campaigns whose `brand_id` belongs to the current user.
- Brand may review applications only for its own campaigns.
- Creator may apply only as the creator profile owned by the current user.
- Collaboration access requires the current user to be the brand owner of the accepted application's campaign or the creator on that application. Admin can access all.
- Deliverables, submissions, contracts, payments, metrics, and reviews inherit access from their collaboration.
- Payments can be created/marked paid only by the owning brand (or admin for correction). Creators read.
- Reviews are written by the owning brand for the creator; admins can moderate.
- Ownership checks return 404 for resources the user must not know exist, and 403 for known-but-forbidden actions where appropriate. The implementation will use a consistent helper to avoid leaking information.

### 6.6 RBAC matrix

| Action | Admin | Brand | Creator |
| --- | --- | --- | --- |
| Create/edit own profile | Yes | Yes (brand) | Yes (creator) |
| Manage social accounts | Read all | Read | Yes (own) |
| Create campaign | No (moderation only) | Yes | No |
| Edit/publish own campaign | Moderate | Yes | No |
| Browse campaigns | Yes | Yes | Yes |
| Apply to campaign | No | No | Yes (own profile) |
| Review applications | Read all | Yes (own campaigns) | Read own |
| Accept/reject application | Corrective only | Yes (own campaigns) | No |
| Manage collaboration | Read all | Yes (own) | Read own / submit work |
| Create deliverables | Corrective only | Yes (own) | No |
| Submit content | No | No | Yes (own deliverables) |
| Approve/reject submissions | Corrective only | Yes (own) | Read own |
| Manage contract | Read all | Yes (own) | Read own |
| Create/mark payments | Read/correct | Yes (own) | Read own |
| Update performance metrics | Corrective | Yes (own) | Read own |
| Write review | Moderate | Yes (own collaboration) | Read own |
| Manage categories | Yes | Read | Read |
| Global reports | Yes | Own analytics | Own analytics |
| Delete users/campaigns | Not in v1 | No | No |

No destructive admin actions (hard deletes of users, cascading campaign deletion) are planned for v1. They create too much data-loss risk with the observed cascade rules. If needed later, they will be previewed and confirmed explicitly.

### 6.7 CSRF, headers, and abuse protection

- All non-GET API requests check `Origin` against the request host (when `Origin` is present). SameSite=Lax cookies are the second layer.
- JSON content type is required for mutations.
- Request bodies are size-limited by the route/DTO design and validated.
- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and a Content Security Policy that allows only required sources.
- User-supplied URLs must use `http`/`https`; URLs are rendered through React escaping.
- Error responses do not include SQL, stack traces, or password data.

---

## 7. API endpoint plan

### 7.1 Conventions

- Reads for pages are done in Server Components through services/repositories. GET APIs exist for client-side filtering, session lookup, health, and reports.
- Mutations use JSON `POST`, `PATCH`, `PUT`, or `DELETE` route handlers.
- Success: `{ "data": ... }`. Failure: `{ "error": { "code": "...", "message": "...", "fields": { ... } } }`.
- Status codes: 200/201 success, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 business-rule failure, 429 rate-limited, 500/503 infrastructure failure.
- All IDs are positive integers validated by Zod.
- Pagination: `page` (>=1), `pageSize` (1-100, default 12) for lists; responses include `page`, `pageSize`, `total`.
- Sorting is restricted to a whitelist per endpoint.

### 7.2 Authentication and account endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Create user + creator/brand profile, issue session. |
| `POST` | `/api/auth/login` | Public | Verify credentials, issue session. |
| `POST` | `/api/auth/logout` | Authenticated | Clear session cookie. |
| `GET` | `/api/auth/session` | Public | Return safe current-session summary or `null`. |
| `GET` | `/api/health` | Public | App and database health, no sensitive details. |

### 7.3 Profile endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `PATCH` | `/api/creator/profile` | Creator | Update own creator profile. |
| `GET` | `/api/creator/social-accounts` | Creator | List own social accounts. |
| `POST` | `/api/creator/social-accounts` | Creator | Add one social account; reject duplicate platform at app level if live DB has no unique constraint. |
| `PATCH` | `/api/creator/social-accounts/[accountId]` | Creator (owner) | Update account. |
| `DELETE` | `/api/creator/social-accounts/[accountId]` | Creator (owner) | Remove account. |
| `PATCH` | `/api/brand/profile` | Brand | Update own brand profile. |

### 7.4 Campaign endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/campaigns` | Public | Filter/sort/paginate open campaigns. |
| `POST` | `/api/brand/campaigns` | Brand | Create campaign plus requirements in one transaction. |
| `GET` | `/api/brand/campaigns/[campaignId]` | Brand (owner) / Admin | Read campaign editor data. |
| `PATCH` | `/api/brand/campaigns/[campaignId]` | Brand (owner) | Update campaign and requirements. |
| `DELETE` | `/api/brand/campaigns/[campaignId]` | Brand (owner) | Only if no applications/collaborations and confirmed; otherwise 409. |
| `PATCH` | `/api/brand/campaigns/[campaignId]/status` | Brand (owner) | Transition `Open` -> `Ongoing` -> `Completed`. |
| `GET` | `/api/brand/campaigns/[campaignId]/applications` | Brand (owner) | Applications for review. |

Campaign publish behavior: the observed schema has no `Draft` status. The default plan is that creating a campaign with status `Open` is the publish action, and editing is allowed while it is `Open`/not completed. If a true draft workflow is required, it needs an approved additive column (for example `published_at` or `is_published`); the plan does not assume one exists.

Filters supported by `GET /api/campaigns`:

- `q` (name/description)
- `categoryId`
- `platform`
- `minBudget`, `maxBudget`
- `minFollowers`
- `minEngagement`
- `endingBefore` / `startsAfter`
- `sort` (`newest`, `budget_desc`, `ending_soon`)
- `page`, `pageSize`

Platform and budget filters use `EXISTS` against `campaign_requirements` and the campaign row. `required_niche` is displayed but cannot be matched to creator data because the schema has no creator niche column.

### 7.5 Application and collaboration endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/creator/campaigns/[campaignId]/applications` | Creator | Apply after eligibility checks and capacity lock. |
| `GET` | `/api/creator/applications` | Creator | Own applications. |
| `POST` | `/api/applications/[applicationId]/accept` | Brand (own campaign) | Accept + create collaboration atomically. |
| `POST` | `/api/applications/[applicationId]/reject` | Brand (own campaign) | Reject a pending application. |
| `GET` | `/api/collaborations/[collaborationId]` | Parties / Admin | Collaboration summary. |
| `PATCH` | `/api/collaborations/[collaborationId]` | Brand (owner) / Admin | Update dates/status within allowed transitions. |

Acceptance payload includes `agreedAmount`, `startDate`, `endDate`. Verification is repeated inside the transaction, including capacity. If the campaign is full or the application is no longer pending, the service returns 409 and does not create a collaboration.

### 7.6 Deliverables, submissions, contracts

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/collaborations/[collaborationId]/deliverables` | Brand (owner) | Create deliverable. |
| `PATCH` | `/api/deliverables/[deliverableId]` | Brand (owner) | Update due date/content type/status. |
| `DELETE` | `/api/deliverables/[deliverableId]` | Brand (owner) | Only when no submissions exist; otherwise 409. |
| `POST` | `/api/deliverables/[deliverableId]/submissions` | Creator (party) | Submit content URL. |
| `POST` | `/api/submissions/[submissionId]/review` | Brand (owner) | Approve or reject; approval also completes the deliverable in one transaction. |
| `PUT` | `/api/collaborations/[collaborationId]/contract` | Brand (owner) | Create/update signed and expiry dates. |
| `GET` | `/api/collaborations/[collaborationId]/contract` | Parties / Admin | Contract details for the printable view. |

Contract document support is conditional on the verified schema. If `contract_document` is absent, the app provides a generated, printable contract page instead of pretending to store a document.

### 7.7 Payments, metrics, reviews

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/collaborations/[collaborationId]/payments` | Brand (owner) | Create pending/paid payment. |
| `PATCH` | `/api/payments/[paymentId]` | Brand (owner) / Admin correction | Mark pending payment paid, update date/reference if the column exists. |
| `PUT` | `/api/collaborations/[collaborationId]/metrics` | Brand (owner) / Admin | Upsert the single metrics row. |
| `PUT` | `/api/collaborations/[collaborationId]/review` | Brand (owner) | Upsert the single review. |
| `DELETE` | `/api/reviews/[reviewId]` | Admin | Moderate a review. |

Payment behavior is explicit in the UI:

- Marking a payment `Paid` may automatically complete the collaboration because of the verified triggers.
- The service re-reads the collaboration and returns the resulting status.
- If multiple payments are supported, the trigger semantics are a known schema limitation. The initial implementation treats a payment as settlement; this must be confirmed with the project owner before supporting partial payments.

### 7.8 Admin endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/admin/reports/overview` | Admin | Global counts, money totals, status breakdowns. |
| `GET` | `/api/admin/reports/campaigns/[campaignId]` | Admin | Campaign report using verified view/procedure or equivalent SQL. |
| `POST` | `/api/admin/categories` | Admin | Create category. |
| `PATCH` | `/api/admin/categories/[categoryId]` | Admin | Rename category. |
| `DELETE` | `/api/admin/categories/[categoryId]` | Admin | Delete only when unused; otherwise 409. |
| `PATCH` | `/api/admin/campaigns/[campaignId]/status` | Admin | Corrective campaign status change. |
| `GET` | `/api/admin/system/db` | Admin | Read-only object/health report. |

Admin user deletion, role changes, and hard deletion of campaigns/collaborations are intentionally excluded from v1 because of cascade risk. If they are added, they require explicit confirmation and a preview of affected rows.

---

## 8. Page and dashboard plan

### 8.1 Shared/public pages

| Page | Content and behavior |
| --- | --- |
| `/` | Landing page with value proposition, role entry points, live platform stats (if safe to show), login/register CTAs. No fabricated testimonials or fake campaigns. |
| `/login` | Email/username + password, errors, loading, next-URL handling. |
| `/register` | Role selector (Creator/Brand), account fields, role-specific profile fields, validation. No Admin option. |
| `/campaigns` | Public discovery: search, category, platform, budget, followers, engagement, sort, pagination. Real data only; empty state. |
| `/campaigns/[id]` | Campaign summary, brand, category, budget, dates, requirements, capacity, status, apply CTA for eligible creators. |
| `/creators/[id]` | Public creator profile, social accounts, follower/engagement summary, completed collaborations, reviews (public-safe fields only). |
| `/brands/[id]` | Public brand profile, industry, location, open campaigns. |
| `/unauthorized` | 403 explanation and role-appropriate link back. |
| `not-found` / error | Friendly 404/500 pages with recovery actions; no stack traces. |

### 8.2 Creator dashboard and pages

| Page | Key content | Empty state |
| --- | --- | --- |
| `/creator` | Profile completeness, open applications, active collaborations, pending deliverables, paid/pending earnings, average rating, recommended open campaigns. | "Complete your profile" / "No applications yet" with links. |
| `/creator/profile` | Personal details, bio, location, picture URL, social accounts (add/edit/delete). | "Add your first social account to become eligible for campaigns." |
| `/creator/campaigns` | Discovery with match indicators based on the creator's social accounts. | "No campaigns match your filters." |
| `/creator/campaigns/[id]` | Full campaign and requirement detail; eligibility explanation; apply button. | Not applicable; shows ineligibility reasons. |
| `/creator/applications` | Status, applied date, campaign, budget; filter by status. | "Browse open campaigns to apply." |
| `/creator/applications/[id]` | Application timeline and campaign context. | Not applicable. |
| `/creator/collaborations` | Active/completed collaborations, agreed amount, due deliverables. | "Accepted applications will appear here." |
| `/creator/collaborations/[id]` | Deliverables, submit content, submission status, contract, payment status, metrics, review. | "Waiting for the brand to add deliverables." |
| `/creator/payments` | Payment records and status. | "No payments recorded yet." |
| `/creator/reviews` | Reviews and rating summary. | "Reviews appear after a collaboration is reviewed." |

### 8.3 Brand dashboard and pages

| Page | Key content | Empty state |
| --- | --- | --- |
| `/brand` | Open/ongoing campaigns, pending applications, active collaborations, paid/pending spend, deliverables awaiting review, reach summary, top creators. | "Create your first campaign." |
| `/brand/profile` | Brand details and contact/location. | "Complete your brand profile." |
| `/brand/campaigns` | All campaigns with status, budget, application counts, fill status. | "No campaigns yet." |
| `/brand/campaigns/new` | Campaign fields, category, budget, dates, capacity, requirements (platform/niche/min engagement), publish action. | Not applicable. |
| `/brand/campaigns/[id]` | Overview, application summary, collaboration summary, campaign performance. | "No applications yet." |
| `/brand/campaigns/[id]/edit` | Edit campaign and requirements; only allowed while editable. | Not applicable. |
| `/brand/campaigns/[id]/applications` | Filterable applications with creator profile, social stats, eligibility, accept/reject actions. | "No applications yet." |
| `/brand/collaborations` | Active/completed, amounts, deliverable progress. | "Accepted applications will appear here." |
| `/brand/collaborations/[id]` | Deliverables, submission review, contract, payments, metrics, review. | "Add the first deliverable." |
| `/brand/creators` | Search creators by platform/followers/engagement/location (no niche field). | "No creators match." |
| `/brand/creators/[id]` | Creator profile, social accounts, collaboration history, reviews. | Not applicable. |
| `/brand/payments` | Payment ledger with pending/paid totals. | "No payments recorded." |

### 8.4 Admin dashboard and pages

| Page | Key content | Empty state |
| --- | --- | --- |
| `/admin` | Users by role, creators/brands, campaigns by status, applications, collaborations, payment totals, average rating, top categories, platform object status. | "No data in the platform yet." |
| `/admin/users` | Search/filter users, role, created date; read-only detail in v1. | "No users found." |
| `/admin/users/[id]` | User, profile, application/campaign/payment summary; no password hashes. | Not applicable. |
| `/admin/creators` | Creator directory with social stats and activity. | "No creators found." |
| `/admin/brands` | Brand directory with campaign counts. | "No brands found." |
| `/admin/campaigns` | All campaigns, filters, moderation status. | "No campaigns found." |
| `/admin/campaigns/[id]` | Campaign, applications, collaborations, payments, metrics, reviews. | Not applicable. |
| `/admin/categories` | Create/rename/delete unused categories. | "No categories configured." |
| `/admin/collaborations` | All collaborations and statuses. | "No collaborations found." |
| `/admin/collaborations/[id]` | Full collaboration record. | Not applicable. |
| `/admin/payments` | All payments, totals, trigger-affected completions. | "No payments found." |
| `/admin/reviews` | Ratings and feedback moderation. | "No reviews found." |
| `/admin/reports` | Aggregates by category/platform/month, top creators/brands, campaign summaries via the verified view/procedure. | "No report data." |
| `/admin/system` | Read-only DB health, schema capabilities, trigger/procedure/view presence, row counts. | Shows missing objects as warnings. |

### 8.5 Dashboard rules

- Every number is computed from MySQL. No hard-coded demo metrics.
- Each list has a real empty state with a useful next action.
- Loading uses skeletons. Errors use a recoverable alert.
- Money is displayed with the configured currency (default INR), from `DECIMAL` strings, not floating-point arithmetic.
- Dates use `APP_TIMEZONE`; `DATE` values are date-only.
- Tables are keyboard-accessible and responsive (card layout on narrow screens).
- Destructive actions use confirmation dialogs and show consequences (for example, "This is the only pending application; deleting it cannot be undone").

---

## 9. Implementation sequence

Each phase ends with verification. A phase is not "done" because the pages render; it is done when the listed checks pass.

| Phase | Work | Exit criteria |
| --- | --- | --- |
| **0. Live verification and decisions** | Obtain credentials; run read-only schema/object/count inspection; create `docs/SCHEMA_VERIFICATION.md`; confirm capacity column, nullable fields, triggers, procedure, view, FK actions; decide on optional additive changes. | Live schema evidence captured; blockers resolved or explicitly accepted; no writes to `creatorconnect`. |
| **1. Scaffold and foundations** | Create Next.js App Router project, strict TypeScript, Tailwind, ESLint; add `.env.example`; implement env validation, MySQL pool, health endpoint, base layout and UI primitives. | `npm run lint`, `npm run typecheck`, `npm run build` pass; `/api/health` verifies DB connectivity. |
| **2. Authentication and RBAC** | Users repository, bcrypt hashing, login/register/logout/session, middleware, role layouts, admin seed script, rate limiting, CSRF check. | Creator and brand can register/login/logout; admin seed works; cross-role access is blocked; duplicate/invalid inputs show safe errors. |
| **3. Profiles and social accounts** | Creator/brand profile forms, social account CRUD, public profile pages, profile completeness. | Profiles persist to MySQL; social accounts are validated; duplicate platform handling is explicit; public pages show real data. |
| **4. Campaigns and discovery** | Brand campaign create/edit/status, requirements editor, capacity, public discovery filters, campaign detail. | Brand can create/edit/publish; discovery filters use real SQL; invalid dates/budget/capacity are rejected; empty states work. |
| **5. Applications and collaborations** | Creator eligibility/apply, unique handling, brand review, accept/reject transaction, capacity locking, collaboration list/detail. | Duplicate application returns 409; over-capacity acceptance is impossible; acceptance creates exactly one collaboration; ownership checks pass. |
| **6. Delivery workspace** | Deliverables CRUD, content submissions, approval/rejection, deliverable completion, generated contract panel. | Creator submits URLs; brand approves/rejects; deliverable status updates atomically; contract dates validate; parties-only access enforced. |
| **7. Payments, metrics, reviews** | Payment record/status flow, trigger-aware re-read, metrics upsert, review upsert, completion behavior. | Marking paid completes collaboration per verified trigger; metrics/reviews are one per collaboration; money is handled as decimals; creator sees status. |
| **8. Dashboards and admin reporting** | All role dashboards, aggregates, admin directories, category management, reports, view/procedure integration, system page. | All dashboard numbers come from SQL; reports handle empty data; admin can manage categories; DB objects shown accurately. |
| **9. Hardening and verification** | Unit/integration/E2E tests, accessibility pass, security checks, error/empty/loading states, README and setup docs, test DB isolation. | Test suites pass; build passes; manual three-role walkthrough passes; no secrets committed; no destructive DB commands in scripts. |
| **10. Optional additive schema changes** | Only if explicitly approved: publish/draft flag, creator niche, review author, contract document, payment reference. | Additive SQL reviewed and applied to a test DB first; production applied only with explicit approval; docs updated. |

The immediate next step after this plan is **Phase 0**, not UI coding. The live schema must be known before repositories and forms are written.

---

## 10. Testing plan and risks

### 10.1 Test layers

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | Zod schemas, password/session helpers, RBAC helpers, money/date formatting, filter validation, error mapping. |
| Integration | Vitest + test MySQL database | Repositories, transactions, unique constraints, capacity locking, payment trigger behavior, view/procedure queries, FK/cascade behavior. Never against `creatorconnect`. |
| Component | Vitest + Testing Library (optional, for complex forms) | Field errors, dialogs, empty states, role-conditional actions. |
| End-to-end | Playwright | Three-role journeys against the running app and test database. |
| Manual/security | Browser + review | Unauthorized URL access, ID tampering, CSRF origin rejection, rate limiting, SQL injection attempts, long inputs, XSS in bios/feedback. |
| Build/quality | npm scripts | `lint`, `typecheck`, `build`. |

### 10.2 Required test scenarios

1. Register a brand and a creator; duplicate email/username rejected.
2. Login/logout; invalid credentials; rate limit; role redirects.
3. Creator adds social accounts; engagement/follower validation; duplicate platform handling.
4. Brand creates a campaign with requirements; invalid dates/budget/capacity rejected.
5. Public discovery filters return correct campaigns; no fabricated results.
6. Creator applies; duplicate application rejected; ineligible creator receives a clear reason.
7. Brand cannot accept another brand's application; creator cannot accept; admin can read.
8. Accepting an application creates exactly one collaboration and respects campaign capacity under concurrent requests.
9. Deliverable creation, submission, approval/rejection, deliverable completion.
10. Contract dates and one-contract-per-collaboration behavior.
11. Payment `Paid` triggers collaboration completion; verify the actual trigger behavior.
12. Metrics and review upserts; one row per collaboration; rating bounds.
13. Dashboard aggregates match direct SQL for seeded test scenarios.
14. Empty states for a brand/creator/admin with no data.
15. Missing view/procedure: app fallback works and admin system page reports the missing object.
16. Access control: changing an ID in a URL does not expose another user's data.
17. No SQL errors or stack traces leak to the browser.
18. `DB_NAME` test guard prevents integration tests from touching `creatorconnect`.

### 10.3 Commands to establish

```text
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
npm run db:verify        # read-only schema/object report
npm run seed:admin       # idempotent, environment-driven
```

### 10.4 Risks and mitigations

| Risk | Severity | Impact | Mitigation |
| --- | --- | --- | --- |
| Live MySQL credentials unavailable | High | Cannot verify schema, triggers, procedure, view, or data; implementation may target the wrong columns. | Block Phase 0 until credentials are provided or a dedicated app user is created. |
| DDL and live schema differ | High | Runtime SQL failures, broken forms, wrong assumptions about nullability and capacity. | Use the verified live schema as source of truth; capability map; never execute the DDL file. |
| DDL contains `DROP DATABASE` | Critical | Total data loss if run. | Document warning; no scripts invoke it; do not add reset commands. |
| Payment triggers complete collaborations on any paid payment | High | Partial payment incorrectly completes work; financial/status inconsistency. | Treat payment as full settlement in v1; surface the trigger result; request a schema/business-rule decision before partial payments. |
| No draft/published campaign state | Medium | Cannot support a true draft workflow. | Treat `Open` as published for v1; optionally add `published_at` only with approval. |
| No creator niche field | Medium | Cannot accurately match `required_niche`. | Show requirements; filter only by platform/followers/engagement; document the limitation; optional additive column if approved. |
| No review author identity | Medium | Cannot support two-sided reviews. | Implement brand-authored review of creator, or add reviewer identity only with approval. |
| Contract document column absent in observed schema | Medium | Cannot store contract files/URLs. | Generate a printable contract from collaboration data; document the limitation. |
| Payment reference column absent in observed schema | Low/Medium | Cannot store transaction references. | Omit or use a non-sensitive note outside payments; optional additive column. |
| Live unique constraints differ | Medium | Duplicate applications/social accounts possible. | Verify indexes/constraints; enforce at application level with transactions; map duplicate errors. |
| FK cascade behavior differs | Medium | Deletes could remove more data than expected. | Verify actual FK actions; avoid destructive deletes in v1; restrict campaign deletion to unused campaigns. |
| `INT` limits for followers/metrics | Low | Overflow on very large values. | Validate to signed 32-bit range until verified; display clearly. |
| No `updated_at` columns | Low | Cannot show edit history. | Do not promise audit history; use existing dates where available. |
| No sessions table | Medium | Stolen JWT cannot be revoked before expiry. | Short 7-day expiry, HttpOnly/Secure cookies, DB re-check of user/role, logout clears; document limitation. |
| In-memory rate limiting | Low | Not shared across instances. | Document; add Redis/DB limiter only if deployed multi-instance. |
| Decimal handling | Medium | Money rounding errors. | Keep DECIMAL as strings; format at the boundary; no floating-point arithmetic for storage. |
| Timezone/date confusion | Medium | Off-by-one-day displays. | `dateStrings: true`; treat `DATE` as date-only; format with configured timezone. |
| Window/MySQL case sensitivity | Low | Query/table-name errors. | Use lowercase table names and verified column names; test on the actual server. |
| Test data leaking to production | High | Real data pollution. | Separate `_test` database guard; no seed of fake production data; explicit env validation. |
| Secret leakage | High | Credential compromise. | `.env.local` git-ignored; `.env.example` only; never log secrets; `.gitignore` verification. |
| Scope expansion before verification | Medium | Rework. | Gate implementation on Phase 0 evidence; build vertical slices with tests. |

### 10.5 Current blockers

1. **MySQL credentials (critical).** The user selected "I'll provide credentials" but the values have not been supplied. Without them, the live schema, triggers, procedure, view, row counts, and data safety cannot be verified. The plan deliberately does not claim they work.
2. **Schema drift (high).** The 2026-08-28 screenshots disagree with the current DDL. We need the live `SHOW CREATE TABLE` output and object checks before writing repositories.
3. **Missing schema support for requested features (medium/high).** Draft/publish, creator niche matching, two-sided review identity, contract documents, and payment references are not supported by the observed schema. Each needs a decision: accept the limitation or approve a small additive migration.
4. **Payment trigger semantics (high).** A single paid payment completes the collaboration. Partial payments or multiple installments would be misleading unless the rule is clarified.
5. **No admin account bootstrap (resolved by design).** The seed script will create one from environment variables; public Admin registration will not be offered.
6. **No test database yet.** Integration tests need a separate `creatorconnect_test` database and permission to create it. This is not destructive to the main database, but requires approval/credentials.

### 10.6 Decisions requested before implementation

1. Provide a MySQL app user/password (least privilege) or approve using an existing account with the password stored only in `.env.local`.
2. Confirm that `mysql2` with parameterized SQL is acceptable as the data-access layer, or require Prisma despite the schema-drift and database-object risks.
3. For campaign publishing: accept "create as `Open` = published" for v1, or approve an additive published/draft column.
4. For partial payments: accept full-settlement semantics, or request a schema/business-rule change.
5. For reviews: accept brand-authored reviews of creators, or approve a reviewer-identity column for two-sided reviews.
6. For niche matching: accept platform/follower/engagement matching only, or approve a creator niche field.
7. For contracts: accept a generated printable contract, or approve a contract-document column.
8. Confirm the display currency (default INR) and timezone (default `Asia/Kolkata`).
9. Approve creation of a separate `_test` database for integration tests.

---

## Appendix A: Explicitly unverified or not yet implemented

- No Next.js application exists yet.
- No authentication, API, page, dashboard, or database repository exists yet.
- The live `creatorconnect` schema has not been inspected in this session.
- The existence of the two payment triggers, `get_campaign_creators`, and `campaign_creator_summary` has not been verified.
- The live row counts and existing data are unknown.
- The live schema's exact FK actions, unique constraints, check constraints, and index names are unknown.
- The current DDL file's schema is not assumed to be the live schema.
- Nothing in this plan should be described as "working" until the corresponding phase's verification has passed.

## Appendix B: Immediate next actions

1. Supply MySQL credentials through a secure channel or create `.env.local` locally.
2. Run `npm run db:verify` (once written) or the read-only SQL in section 2.5.
3. Save the evidence to `docs/SCHEMA_VERIFICATION.md`.
4. Resolve the decisions in section 10.6.
5. Start Phase 1 (scaffold) only after Phase 0 is complete.
