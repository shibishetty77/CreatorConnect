# CreatorConnect - Phase 4 Dashboards and Profile Management

**Phase:** Phase 4 - role-specific dashboards and profile management  
**Status:** Implemented and verified on 2026-11-02  
**Framework:** Next.js `16.4.3` App Router, React `19.3.1`, TypeScript `7.0.2`  
**Database:** MySQL `8.0.46`, database `creatorconnect`  
**Seed data:** 259 records across 15 base tables, unchanged by Phase 4

> **Database safety:** Phase 4 did not drop, truncate, recreate, or alter the
> live database. It did not add columns or remove seeded records. The live
> database still contains the original 259 records. Mutation tests ran against
> a temporary clone named `creatorconnect_phase4_test_*`, which was dropped
> after the test suite completed.

---

## 1. Delivered scope

### Creator dashboard - `/creator/dashboard`

- Welcome banner with the authenticated creator's first name.
- Live statistics from MySQL:
  - Open campaign count.
  - Total submitted applications.
  - Accepted applications.
  - Rejected applications.
  - Active collaborations.
  - Completed collaborations.
  - Pending deliverables.
  - Paid, pending, and agreed payment totals.
- Profile snapshot: location, contact number, account email, and biography.
- Social reach summary with every social account, follower count, and
  engagement rate.
- Recent activity feed built from applications, collaborations, deliverables,
  and payments.
- Empty states for no social accounts and no activity.
- Sidebar navigation: Overview, Discover Campaigns, My Applications,
  Collaborations, Deliverables, Payments, My Profile, Settings.
- Overview and My Profile are fully functional. Other sections are designed
  placeholders reserved for Phase 5 campaign lifecycle work.

### Brand dashboard - `/brand/dashboard`

- Welcome banner with the authenticated brand name.
- Live statistics from MySQL:
  - Total campaigns.
  - Open, ongoing, and completed campaigns.
  - Total creator applications.
  - Pending creator applications.
  - Active collaborations.
  - Total sponsorship budget across the brand's campaigns.
- Payment summary for paid and pending amounts.
- Campaign status mix.
- Brand profile summary.
- Recent activity feed built from campaigns, applications, collaborations,
  deliverables, and payments.
- Sidebar navigation: Overview, My Campaigns, Create Campaign, Creator
  Applications, Collaborations, Deliverables, Payments, Brand Profile,
  Settings.
- Overview and Brand Profile are fully functional. Other sections are designed
  placeholders reserved for Phase 5 campaign lifecycle work.

### Admin dashboard - `/admin/dashboard`

- Platform-wide read-only statistics:
  - Registered users.
  - Creator profiles.
  - Brand profiles.
  - Campaigns.
  - Collaborations.
  - Completed collaborations.
  - Payment records.
  - Total platform activity.
- Role mix and campaign status distribution.
- Payment oversight totals.
- Recent user registrations.
- Recent campaigns.
- Recent collaborations.
- No administrative write actions were added. All admin queries are read-only.

### Creator profile - `/creator/profile`

- View and update first name, last name, date of birth, phone, biography,
  address, city, state, and profile picture URL.
- View social accounts with platform, username, followers, engagement rate, and
  profile URL.
- Add a social account.
- Edit an existing social account.
- Delete a social account.
- Ownership is enforced in every social account SQL statement with both
  `account_id` and the session-derived `creator_id`.

### Brand profile - `/brand/profile`

- View and update brand name, industry, contact number, address, city, and
  state.
- Profile preview with brand identity and contact details.
- Brand description and website are **not** editable because those columns do
  not exist in the approved live schema. They were not invented and no schema
  change was made.

---

## 2. Role-based data access

Authorization uses three layers:

1. `src/proxy.ts` performs a coarse route-prefix check against the signed JWT.
2. Server pages repeat the check with `requireRole("Creator" | "Brand" |
   "Admin")`.
3. API route handlers use `requireApiRole(...)`, which reloads the user and
   role from MySQL through `getCurrentUser()`.

The current user ID is never accepted from the browser for ownership decisions.
The server obtains `userId`, `creatorId`, and `brandId` from the authenticated
session and the database profile row.

| Route group | Creator | Brand | Admin | Unauthenticated |
| --- | --- | --- | --- | --- |
| `/creator/**` | Allowed | `/forbidden` | `/forbidden` | `/login` |
| `/brand/**` | `/forbidden` | Allowed | `/forbidden` | `/login` |
| `/admin/**` | `/forbidden` | `/forbidden` | Allowed | `/login` |
| `/api/creator/**` | Allowed | `403` | `403` | `401` |
| `/api/brand/**` | `403` | Allowed | `403` | `401` |

Every protected page also re-reads the role from MySQL, so a stale or forged
frontend role value cannot grant access.

---

## 3. Repository and service layer

Phase 4 keeps SQL out of React components.

| File | Responsibility |
| --- | --- |
| `src/lib/repositories/creator-profiles.ts` | Creator profile reads/updates and social account CRUD |
| `src/lib/repositories/brand-profiles.ts` | Brand profile reads/updates |
| `src/lib/repositories/dashboard.ts` | Creator, brand, and admin dashboard aggregates |
| `src/lib/repositories/dashboard-types.ts` | Shared status-count and activity types |
| `src/lib/validations/profiles.ts` | Zod schemas for profile and social account mutations |
| `src/lib/auth/api.ts` | Authenticated API actor helper and role enforcement |
| `src/lib/auth/csrf.ts` | Origin, content-type, and body-size checks |

All SQL is parameterized through the existing `mysql2/promise` pool in
`src/lib/db.ts`. No second pool, ORM, or client-side database access was added.

### Transactions

Phase 4 profile writes touch one table per operation:

- Creator profile: one `UPDATE creators ...` statement.
- Social account create/edit/delete: one statement per operation.
- Brand profile: one `UPDATE brands ...` statement.

Transactions are therefore not required for these single-table mutations. The
existing registration transaction in `src/lib/auth/users.ts` remains unchanged.
Any future operation that updates multiple related tables must use the existing
pool's `beginTransaction` / `commit` / `rollback` pattern.

---

## 4. Database queries used

Only existing tables and columns are used. The live schema has 15 base tables.

### Creator dashboard

```sql
-- Open campaign count
SELECT COUNT(*) FROM campaigns WHERE status = 'Open';

-- Application counts for the authenticated creator
SELECT status, COUNT(*) FROM applications
WHERE creator_id = ? GROUP BY status;

-- Collaboration counts for the authenticated creator
SELECT co.status, COUNT(*)
FROM collaborations co
INNER JOIN applications a ON a.application_id = co.application_id
WHERE a.creator_id = ?
GROUP BY co.status;

-- Deliverable counts for the authenticated creator
SELECT d.status, COUNT(*)
FROM deliverables d
INNER JOIN collaborations co ON co.collaboration_id = d.collaboration_id
INNER JOIN applications a ON a.application_id = co.application_id
WHERE a.creator_id = ?
GROUP BY d.status;

-- Payment totals for the authenticated creator
SELECT p.status, COUNT(*), COALESCE(SUM(p.amount), 0)
FROM payments p
INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
INNER JOIN applications a ON a.application_id = co.application_id
WHERE a.creator_id = ?
GROUP BY p.status;

-- Total agreed collaboration value
SELECT COALESCE(SUM(co.agreed_amount), 0)
FROM collaborations co
INNER JOIN applications a ON a.application_id = co.application_id
WHERE a.creator_id = ?;
```

Recent creator activity is a `UNION ALL` of applications, collaborations,
deliverables, and payments, ordered by event date, limited to eight rows.

### Brand dashboard

```sql
-- Campaign counts for the authenticated brand
SELECT status, COUNT(*) FROM campaigns
WHERE brand_id = ? GROUP BY status;

-- Total sponsorship budget
SELECT COALESCE(SUM(budget), 0) FROM campaigns WHERE brand_id = ?;

-- Applications received by the brand's campaigns
SELECT a.status, COUNT(*)
FROM applications a
INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
WHERE ca.brand_id = ?
GROUP BY a.status;

-- Collaborations for the brand's campaigns
SELECT co.status, COUNT(*)
FROM collaborations co
INNER JOIN applications a ON a.application_id = co.application_id
INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
WHERE ca.brand_id = ?
GROUP BY co.status;

-- Payment totals for the brand's campaigns
SELECT p.status, COUNT(*), COALESCE(SUM(p.amount), 0)
FROM payments p
INNER JOIN collaborations co ON co.collaboration_id = p.collaboration_id
INNER JOIN applications a ON a.application_id = co.application_id
INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
WHERE ca.brand_id = ?
GROUP BY p.status;
```

Recent brand activity is a `UNION ALL` of campaigns, applications,
collaborations, deliverables, and payments, ordered by event date, limited to
eight rows.

### Admin dashboard

The admin dashboard executes read-only aggregate subqueries over `users`,
`creators`, `brands`, `campaigns`, `collaborations`, `payments`,
`applications`, `content_submissions`, and `reviews`, plus three limited
recent-record queries:

- Recent users ordered by `created_at`.
- Recent campaigns ordered by `start_date`.
- Recent collaborations ordered by `start_date`.

### Collation fix

The live database uses `utf8mb4_0900_ai_ci` table collations while the mysql2
connection reports `utf8mb4_unicode_ci`. The activity `UNION ALL` queries now
apply `COLLATE utf8mb4_0900_ai_ci` to the literal event types and concatenated
titles. This prevents MySQL error `ER_CANT_AGGREGATE_NCOLLATIONS` ("Illegal mix
of collations for operation 'UNION'") without changing the database schema or
connection settings.

---

## 5. Profile management implementation

### Creator profile

`PATCH /api/creator/profile` accepts:

- `firstName` (required, maximum 50 characters).
- `lastName` (maximum 50 characters).
- `dateOfBirth` (optional ISO date, not in the future).
- `phone` (optional, 7-15 characters, matching `VARCHAR(15)`).
- `bio` (optional, maximum 2,000 characters).
- `address` (optional, maximum 255 characters).
- `city` (optional, maximum 100 characters).
- `state` (optional, maximum 100 characters).
- `profilePictureUrl` (optional HTTP/HTTPS URL, maximum 500 characters).

The SQL update is:

```sql
UPDATE creators
SET first_name = ?, last_name = ?, date_of_birth = ?, phone = ?,
    bio = ?, address = ?, city = ?, state = ?, profile_picture_url = ?
WHERE creator_id = ?;
```

The `creator_id` comes from the session's profile row, not from the request
body. Unknown body fields such as `creatorId` are discarded by the Zod object
schema and cannot redirect the update to another creator.

### Social accounts

`POST /api/creator/social-accounts` creates an account for the authenticated
creator. The accepted fields are:

- Platform: `Instagram`, `YouTube`, `LinkedIn`, `Twitter`, or `Facebook`.
- Username: required, maximum 100 characters.
- Followers: non-negative whole number.
- Engagement rate: 0-100 with at most two decimal places.
- Profile URL: optional HTTP/HTTPS URL, maximum 255 characters.

`PATCH /api/creator/social-accounts/[accountId]` updates an account only when
both `account_id = ?` and `creator_id = ?` match. `DELETE` uses the same
ownership predicate. A different creator receives `404` and cannot read, edit,
or delete the account.

### Brand profile

`PATCH /api/brand/profile` accepts:

- `brandName` (required, maximum 150 characters).
- `industry` (optional, maximum 100 characters).
- `contactNumber` (optional, 7-15 characters, matching `VARCHAR(15)`).
- `address` (optional, maximum 255 characters).
- `city` (optional, maximum 100 characters).
- `state` (optional, maximum 100 characters).

The SQL update is:

```sql
UPDATE brands
SET brand_name = ?, industry = ?, contact_number = ?, address = ?,
    city = ?, state = ?
WHERE brand_id = ?;
```

The `brand_id` comes from the session's profile row. A `brandId` field supplied
by the browser is ignored.

### Schema limitation

The approved live `brands` table has no `description` or `website` column. The
Phase 4 instructions require existing-schema-only changes and prohibit schema
modification without approval. Those two fields were therefore not added and no
data was invented. The Brand Profile page explicitly documents this limitation.

---

## 6. API routes and server actions

Phase 4 uses route handlers under `/api`; no server actions were added.

| Method | Route | Access | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/creator/profile` | Creator | Own profile only |
| `PATCH` | `/api/creator/profile` | Creator | Validate and update own profile |
| `GET` | `/api/creator/social-accounts` | Creator | List own social accounts |
| `POST` | `/api/creator/social-accounts` | Creator | Create own social account |
| `PATCH` | `/api/creator/social-accounts/[accountId]` | Creator | Update own account |
| `DELETE` | `/api/creator/social-accounts/[accountId]` | Creator | Delete own account |
| `GET` | `/api/brand/profile` | Brand | Own brand profile only |
| `PATCH` | `/api/brand/profile` | Brand | Validate and update own profile |

Mutation safeguards:

- Authentication and role checks through `requireApiRole`.
- Session-derived ownership IDs.
- Zod validation on every body.
- JSON content type required.
- `Origin` checked when present.
- JSON body limited to 32 KB.
- Parameterized SQL only.
- Database errors logged server-side and replaced with generic client messages.
- No password hashes or other sensitive fields returned.

---

## 7. UI and component system

Phase 4 reuses and extends the existing design system in
`src/app/globals.css`.

- Responsive sidebar with mobile overlay navigation and Escape-key handling.
- Skip link and semantic landmarks.
- Shared `DashboardShell` for all three roles.
- Shared `PageHeader`, `StatCard`, `StatusBadge`, and `ActivityFeed`.
- Card grids and data tables for admin records.
- `DashboardSkeleton` loading states for Creator, Brand, and Admin route
  groups.
- Route-level error boundaries with a retry action.
- Empty states for absent social accounts, campaigns, and activity.
- Success, error, and field-level validation messages in profile forms.
- Accessible labels, `aria-invalid`, `aria-describedby`, and status roles.
- Placeholder pages for sections intentionally deferred to Phase 5.

---

## 8. Testing

### Commands executed

```powershell
npm run typecheck
npm run build
npm run test:dashboards
npm run test:auth
```

### Results

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | PASS |
| Next.js production build | PASS, 35 routes generated |
| Phase 4 dashboard/profile integration tests | 12 passed, 0 failed |
| Phase 3 authentication regression tests | 18 passed, 0 failed |

### Phase 4 integration test suite

`scripts/test-dashboards.ts`:

1. Verifies the live database still has 15 base tables and exactly 259 rows.
2. Creates a temporary database named `creatorconnect_phase4_test_*`.
3. Clones all 15 base table schemas and rows into the temporary database.
4. Starts the production Next.js server against the temporary database.
5. Signs role sessions for seeded creator, brand, and admin accounts for the
   duration of the run.
6. Executes real HTTP requests against pages and API routes.
7. Verifies dashboard metric values against direct SQL counts.
8. Verifies profile and social account mutations directly in MySQL.
9. Drops only the temporary database in a `finally` block.
10. Rechecks the live database row counts after the run.

| # | Test | Result |
| ---: | --- | --- |
| 1 | Seeded live database remains untouched and complete | PASS |
| 2 | Unauthenticated dashboard and profile requests are blocked | PASS |
| 3 | Creator dashboard only shows the authenticated creator data | PASS |
| 4 | Creator profile loads and updates only the session profile | PASS |
| 5 | Creator profile rejects invalid data and cross-role writes | PASS |
| 6 | Social account create, edit and delete persist and enforce ownership | PASS |
| 7 | Brand dashboard only shows the authenticated brand data | PASS |
| 8 | Brand profile loads and updates only the session brand | PASS |
| 9 | Brand profile rejects invalid data and cross-role writes | PASS |
| 10 | Creator and brand workspaces are isolated in both directions | PASS |
| 11 | Admin dashboard exposes platform-wide read-only statistics | PASS |
| 12 | Live database still contains exactly 259 records after the run | PASS |

Captured summary:

```text
DASHBOARD TEST SUMMARY: 12 passed, 0 failed
```

### What the tests prove

- Dashboard statistics match direct SQL aggregates, not hardcoded values.
- Creator pages do not contain another creator's email or data.
- Brand pages do not contain another brand's profile or campaigns.
- Admin sees platform-wide totals.
- Creator cannot access Brand or Admin pages or APIs.
- Brand cannot access Creator or Admin pages or APIs.
- Admin cannot use Creator or Brand profile APIs.
- Profile updates persist in MySQL.
- A body-supplied `creatorId` or `brandId` does not change another record.
- Social account create, edit, and delete persist correctly.
- A different creator receives `404` for another creator's social account.
- Invalid names, phone lengths, URLs, platforms, follower counts, and
  engagement rates are rejected with `400`.
- Unauthenticated page requests redirect to `/login`.
- Unauthenticated API requests return `401`.
- The live 259 seeded records are unchanged.

### Phase 3 regression

`npm run test:auth` was updated to create the additional read-only tables that
the new dashboards query, and its dashboard assertion now checks the Phase 4
welcome content. All 18 authentication tests still pass.

---

## 9. Files created and modified in Phase 4

### Created

- `src/lib/repositories/creator-profiles.ts`
- `src/lib/repositories/brand-profiles.ts`
- `src/lib/repositories/dashboard-types.ts`
- `src/lib/repositories/dashboard.ts`
- `src/lib/validations/profiles.ts`
- `src/components/dashboard/ActivityFeed.tsx`
- `src/components/dashboard/DashboardShell.tsx`
- `src/components/dashboard/DashboardSkeleton.tsx`
- `src/components/dashboard/DashboardError.tsx`
- `src/components/dashboard/NavIcon.tsx`
- `src/components/dashboard/PageHeader.tsx`
- `src/components/dashboard/SectionPlaceholder.tsx`
- `src/components/dashboard/StatCard.tsx`
- `src/components/dashboard/StatusBadge.tsx`
- `src/components/profile/CreatorProfileForm.tsx`
- `src/components/profile/BrandProfileForm.tsx`
- `src/components/profile/SocialAccountsManager.tsx`
- `src/lib/navigation.ts`
- `src/lib/format.ts`
- `src/lib/api/response.ts`
- `src/lib/auth/api.ts`
- `src/lib/auth/csrf.ts`
- `src/app/creator/layout.tsx`, `loading.tsx`, `error.tsx`
- `src/app/creator/dashboard/page.tsx`
- `src/app/creator/profile/page.tsx`
- Creator placeholder pages for campaigns, applications, collaborations,
  deliverables, payments, and settings
- `src/app/brand/layout.tsx`, `loading.tsx`, `error.tsx`
- `src/app/brand/dashboard/page.tsx`
- `src/app/brand/profile/page.tsx`
- Brand placeholder pages for campaigns, new campaign, applications,
  collaborations, deliverables, payments, and settings
- `src/app/admin/layout.tsx`, `loading.tsx`, `error.tsx`
- `src/app/admin/dashboard/page.tsx`
- Admin placeholder pages for users, creators, brands, campaigns,
  collaborations, payments, and settings
- `src/app/api/creator/profile/route.ts`
- `src/app/api/creator/social-accounts/route.ts`
- `src/app/api/creator/social-accounts/[accountId]/route.ts`
- `src/app/api/brand/profile/route.ts`
- `scripts/test-dashboards.ts`
- `docs/DASHBOARDS.md`

### Modified in this phase

- `src/lib/repositories/dashboard.ts` - completed metrics and collation-safe
  activity unions.
- `src/lib/validations/profiles.ts` - phone validation aligned to
  `VARCHAR(15)`.
- `src/components/profile/CreatorProfileForm.tsx` - phone input maximum 15.
- `src/components/profile/BrandProfileForm.tsx` - phone input maximum 15.
- `src/lib/navigation.ts` - exact brand sidebar labels.
- `src/app/creator/dashboard/page.tsx` - rejected and completed metrics.
- `src/app/brand/dashboard/page.tsx` - ongoing, completed, and pending metrics.
- `src/app/brand/profile/page.tsx` - schema limitation note.
- `scripts/test-auth.ts` - tables and assertion needed by Phase 4 dashboards.
- `package.json` - added `test:dashboards`.

---

## 10. Security checks

- No user identifier is trusted from the frontend for profile ownership.
- Creator queries always filter by the session's `creator_id`.
- Brand queries always filter by the session's `brand_id`.
- Social account updates and deletes require both account and creator match.
- Cross-role page access redirects to `/forbidden`.
- Cross-role API access returns `403`.
- Unauthenticated API access returns `401`.
- Unauthenticated page access redirects to `/login`.
- All mutations validate the Zod schema before touching the database.
- All SQL is parameterized.
- No password hash, database error, or stack trace is sent to the browser.
- Admin queries are read-only.
- No database schema or seeded data was modified.
- No authentication or authorization rule was weakened.

---

## 11. Known limitations and deferred work

1. **Brand description and website:** unavailable because the approved schema
   has no such columns. A schema change requires project-owner approval.
2. **Campaign lifecycle:** campaign creation, editing, application review, and
   collaboration management remain Phase 5 work. Related sidebar pages are
   designed placeholders.
3. **Admin writes:** user moderation, campaign moderation, and platform settings
   are intentionally read-only in Phase 4.
4. **Profile picture:** only a URL is stored; no file upload pipeline exists.
5. **Settings:** account settings pages are placeholders. Password changes and
   notification preferences are not implemented yet.

Phase 4 is complete. Phase 5 work should not begin until explicitly approved.
