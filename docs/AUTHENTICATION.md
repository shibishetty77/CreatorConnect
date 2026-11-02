# CreatorConnect - Authentication and Role-Based Authorization

**Phase:** Phase 3  
**Status:** Complete and verified on 2026-11-01  
**Framework:** Next.js `16.4.3` App Router, React `19.3.1`, TypeScript `7.0.2`  
**Database:** MySQL `8.0.46`, database `creatorconnect`  
**Session model:** Signed JWT in an HttpOnly cookie  
**Password hashing:** bcrypt, cost `12`

> **Phase 4 note:** the authentication model described here is unchanged. The
> Creator, Brand, and Admin dashboards are now fully implemented in Phase 4; see
> `docs/DASHBOARDS.md` for dashboard features, profile management, queries, and
> Phase 4 test results.

> **Database safety:** No tables, columns, constraints, triggers, procedures,
> views, or seeded rows were changed. The seeded database still contains the
> same 259 records across 15 tables. All destructive integration testing ran
> against a temporary `creatorconnect_auth_test_*` database, which was dropped
> after the suite completed.

---

## 1. Architecture

```text
Browser
  |
  |  HTML forms + fetch (same-origin JSON)
  v
Next.js App Router
  |
  +-- src/proxy.ts
  |     Coarse route gate
  |     Verifies signed session and checks route prefix vs role
  |
  +-- Server Components / Route Handlers
  |     requireUser() / requireRole()
  |     Re-reads the user and role from MySQL
  |
  +-- src/lib/auth/*
  |     password.ts   bcrypt hash and verification
  |     token.ts      HS256 JWT sign and verify
  |     session.ts    HttpOnly cookie lifecycle
  |     users.ts      parameterized user/profile queries
  |     guards.ts     server-side authorization
  |
  v
src/lib/db.ts - existing mysql2/promise pool
  |
  v
MySQL 8.0 - creatorconnect
```

The implementation uses the existing database pool in `src/lib/db.ts`. No second
pool, ORM, or client-side database access was introduced.

### Verified live schema assumptions

| Table | Columns used by authentication |
| --- | --- |
| `users` | `user_id`, `username`, `email`, `password_hash`, `role`, `created_at` |
| `creators` | `creator_id`, `user_id`, `first_name`, `last_name`, `phone`, `city`, `state` |
| `brands` | `brand_id`, `user_id`, `brand_name`, `industry`, `contact_number`, `city`, `state` |

The live `users.role` column is an enum: `Admin`, `Brand`, `Creator`. The live
`password_hash` column is `VARCHAR(255) NOT NULL`. There is no separate sessions
table.

---

## 2. Session handling

### Token

The server issues a signed JWT using `jose`:

| Claim | Value |
| --- | --- |
| `sub` | Numeric `users.user_id` |
| `role` | `Admin`, `Brand`, or `Creator` from the database |
| `username` | Account username |
| `iat` | Issued-at time |
| `exp` | Expiry time |

- Algorithm: `HS256`.
- Default lifetime: 7 days.
- Configurable lifetime: `AUTH_SESSION_TTL_SECONDS` (60 to 2,592,000 seconds).
- Secret: `AUTH_SECRET`, minimum 32 characters. Missing or short secrets fail
  closed.
- Tampered, expired, or malformed tokens are rejected.

### Cookie

The token is stored in `cc_session` with these attributes:

| Attribute | Value |
| --- | --- |
| `HttpOnly` | Yes |
| `SameSite` | `Lax` |
| `Secure` | Yes in production |
| `Path` | `/` |
| `Max-Age` | Matches the token lifetime |

Authentication is **not** stored in `localStorage` or `sessionStorage`.

### Current-user lookup

`getCurrentUser()` verifies the cookie token, then reads the account and profile
from MySQL. It returns `null` when the token is invalid, expired, or the account
no longer exists. The role used by protected pages is the current database role,
not a role supplied by the browser.

### Logout and expiry

Logout clears the cookie by setting an empty value with `Max-Age=0`. Expired
sessions are rejected automatically.

**Accepted limitation:** because there is no sessions table and no token
revocation list, a copied JWT remains technically valid until it expires even
after the browser logs out. Sensitive server operations re-check the user in the
database. A production deployment with stronger revocation needs a server-side
session store or token version column.

---

## 3. Password hashing

- Passwords are hashed with bcrypt cost `12` using `bcryptjs`.
- Plaintext passwords are never stored, logged, or returned.
- Password hashes are selected only by the login query and are never included in
  any API response, page prop, or client payload.
- Password rules:
  - 8 to 72 characters.
  - Maximum 72 bytes for bcrypt.
  - At least one letter and one number.
  - Confirmation must match.
- A fixed dummy bcrypt hash is compared when the identifier is unknown so the
  login path performs a comparable bcrypt check and does not reveal whether an
  email/username exists.

---

## 4. Registration

Public registration accepts only `Creator` and `Brand`. The Zod schema rejects
`Admin` before any database write.

### Flow

1. Validate JSON content type, request origin, and body size.
2. Validate username, name, email, password, confirmation, and role with Zod.
3. Normalize username and email to lowercase.
4. Hash the password with bcrypt.
5. Start a MySQL transaction.
6. Insert the `users` row.
7. Insert the matching profile:
   - `Creator`: split the full name into `first_name` and `last_name`, insert
     into `creators`.
   - `Brand`: insert the brand name into `brands`.
8. Commit. Any failure rolls back both the user and profile.
9. Create the session cookie and return the role dashboard URL.

Duplicate email or username is caught from the unique constraints and returned
as `409` with a field-level error. A new account is signed in immediately.

The registration API never accepts or creates an Admin account.

---

## 5. Login

- Identifier: email or username.
- Lookup is parameterized and follows the database collation.
- The password is checked against the stored bcrypt hash.
- Wrong identifier and wrong password return the same generic `401` message.
- Successful login re-reads the role from MySQL and creates a new session.
- Redirect target:

| Role | Redirect |
| --- | --- |
| Creator | `/creator/dashboard` |
| Brand | `/brand/dashboard` |
| Admin | `/admin/dashboard` |

- A `next` path is accepted only when it is relative and belongs to the
  authenticated role's route prefix. Unsafe or cross-role paths fall back to the
  role dashboard.
- Failed attempts are limited in memory to 5 per IP + identifier per 15 minutes.
  The limiter is process-local; a multi-instance deployment should use Redis or
  a database-backed limiter.

---

## 6. Role-based access control

`src/proxy.ts` enforces a coarse route gate. Every protected page repeats the
check with `requireUser()` or `requireRole()` and reloads the role from MySQL.

| Route | Unauthenticated | Creator | Brand | Admin |
| --- | --- | --- | --- | --- |
| `/`, `/login`, `/register` | Allowed | Allowed | Allowed | Allowed |
| `/login`, `/register` when signed in | - | Redirect to dashboard | Redirect to dashboard | Redirect to dashboard |
| `/dashboard` | Redirect to login | Redirect to Creator dashboard | Redirect to Brand dashboard | Redirect to Admin dashboard |
| `/creator/**` | Redirect to login | Allowed | `/forbidden` | `/forbidden` |
| `/brand/**` | Redirect to login | `/forbidden` | Allowed | `/forbidden` |
| `/admin/**` | Redirect to login | `/forbidden` | `/forbidden` | Allowed |
| `/api/auth/me` | `401` | Own profile | Own profile | Own profile |
| `/api/auth/logout` | Allowed | Allowed | Allowed | Allowed |

No endpoints expose another user's private data. The only profile endpoint is
`/api/auth/me`, which returns the current session's account.

---

## 7. API routes

All routes use the Node.js runtime and return `Cache-Control: no-store`.

| Method | Route | Authentication | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | `201` with user and redirect | `400`, `409`, `413`, `415`, `500` |
| `POST` | `/api/auth/login` | Public | `200` with user and redirect | `400`, `401`, `429`, `500` |
| `POST` | `/api/auth/logout` | Optional | `200` and cleared cookie | `403`, `500` |
| `GET` | `/api/auth/me` | Required | `200` with current user | `401`, `500` |

Error response shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "email": "Enter a valid email address."
    }
  }
}
```

Database errors, SQL text, stack traces, password hashes, and credentials are
never returned to the browser.

### Mutation protection

- `Origin` is checked when present.
- Mutation endpoints require `application/json` (logout accepts an empty body).
- JSON request bodies are limited to 32 KB.
- SameSite=Lax cookies provide a second layer of CSRF protection.
- All SQL uses `?` placeholders through the existing mysql2 pool.

---

## 8. Pages and components

| Path | Purpose |
| --- | --- |
| `/` | Landing page with sign-in and registration entry points |
| `/login` | Professional sign-in form with validation, loading, error, and password visibility |
| `/register` | Creator/Brand registration with role selector and validation |
| `/dashboard` | Role-aware redirect to the correct dashboard |
| `/creator/dashboard` | Minimal protected Creator placeholder |
| `/brand/dashboard` | Minimal protected Brand placeholder |
| `/admin/dashboard` | Minimal protected Admin placeholder |
| `/forbidden` | 403 page for authenticated cross-role access |

The forms are client components. They validate locally for fast feedback and rely
on the same Zod schemas on the server as the authority. No dashboard campaign,
collaboration, payment, or review feature was implemented in this phase.

---

## 9. Environment variables

Add these to the server-side `.env` or `.env.local`. Never use a
`NEXT_PUBLIC_` prefix for any of them.

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | Yes | JWT signing secret; at least 32 random characters |
| `AUTH_SESSION_TTL_SECONDS` | No | Session lifetime; default `604800` (7 days) |
| `ADMIN_USERNAME` | Bootstrap only | Admin username for `auth:create-admin` |
| `ADMIN_EMAIL` | Bootstrap only | Admin email for `auth:create-admin` |
| `ADMIN_PASSWORD` | Bootstrap only | Admin password for `auth:create-admin` |

Generate a secret locally:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not commit the generated value, `.env`, or `.env.local`.

---

## 10. Admin bootstrap

Admin accounts cannot be created through `/register` or
`/api/auth/register`. Use the server-only script:

```powershell
$env:ADMIN_USERNAME = "platform.admin"
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "use-a-strong-unique-password"
npm run auth:create-admin
Remove-Item Env:ADMIN_PASSWORD
```

Alternatively, place the three `ADMIN_*` values in the ignored local `.env` and
run `npm run auth:create-admin`.

Behaviour:

- Validates all three values with Zod.
- Hashes the password with bcrypt cost 12.
- Inserts one `users` row with role `Admin`.
- Refuses to overwrite an existing non-admin account that uses the same email or
  username.
- If the exact admin already exists, reports it and makes no changes.
- Never prints the password or hash.

The script was executed against the temporary test database in the test suite.
It was **not** run against the seeded `creatorconnect` database, so the seeded
259 records remain unchanged.

---

## 11. Testing

### Commands

```powershell
npm run typecheck
npm run build
npm run test:auth
```

`npm run test:auth` requires a completed production build.

### Test database isolation

`scripts/test-auth.ts`:

1. Creates a temporary database named
   `creatorconnect_auth_test_<time>_<random>`.
2. Creates only the `users`, `creators`, and `brands` tables needed by auth.
3. Runs the real `scripts/create-admin.ts` bootstrap against that database.
4. Starts the production Next.js server on a free local port with
   `DB_NAME` pointed at the temporary database.
5. Exercises the real HTTP routes, cookies, proxy redirects, and protected pages.
6. Verifies stored bcrypt hashes and profile rows directly in the test database.
7. Drops only the temporary test database in a `finally` block.

The seeded `creatorconnect` database is never written to by the test suite.
After the run, a separate read-only check confirmed:

| Table | Rows |
| --- | ---: |
| `users` | 14 |
| `creators` | 8 |
| `brands` | 5 |
| `campaigns` | 11 |
| `applications` | 34 |
| `collaborations` | 16 |
| `payments` | 17 |
| `reviews` | 12 |

No temporary test database remained after cleanup.

### Executed results

**Typecheck:** PASS  
**Production build:** PASS  
**Authentication integration tests:** 18 passed, 0 failed

| # | Test | Result |
| ---: | --- | --- |
| 1 | Unauthenticated protected page redirects to login | PASS |
| 2 | Creator registration creates user and profile | PASS |
| 3 | Creator can read own profile | PASS |
| 4 | Creator can open Creator dashboard | PASS |
| 5 | Creator cannot open Brand or Admin dashboards | PASS |
| 6 | Duplicate email registration is rejected | PASS |
| 7 | Admin cannot be created through public registration | PASS |
| 8 | Brand registration creates user and Brand profile | PASS |
| 9 | Brand can open Brand dashboard only | PASS |
| 10 | Valid credentials create a session | PASS |
| 11 | Invalid and unknown credentials share a generic error | PASS |
| 12 | Login is rate limited after repeated failures | PASS |
| 13 | Session cookie is rejected after expiry | PASS |
| 14 | Tampered session cookie is rejected | PASS |
| 15 | Admin bootstrap login works and Admin routes are isolated | PASS |
| 16 | Dashboard redirect respects the authenticated role | PASS |
| 17 | Authenticated users are redirected away from login | PASS |
| 18 | Logout clears the session cookie | PASS |

Captured summary:

```text
AUTH TEST SUMMARY: 18 passed, 0 failed
```

### What the tests verified

- Creator and Brand registration both create the user and matching profile in
  one transaction.
- Password hashes are bcrypt `$2b$12$` values, not plaintext.
- Duplicate email returns `409` and does not create a second user.
- Admin registration is rejected with `400` and creates no row.
- Valid login sets an HttpOnly, SameSite=Lax, Secure production cookie.
- Invalid and unknown credentials return the same `401` message.
- Repeated failures return `429`.
- Expired and tampered tokens return `401`.
- Unauthenticated page access redirects to `/login`.
- Creator, Brand, and Admin route isolation works in both directions.
- Admin bootstrap login works.
- Logout clears the cookie with `Max-Age=0`.
- The seeded database was not modified.

---

## 12. Security controls implemented

- bcrypt password hashing at cost 12.
- No plaintext passwords or password hashes returned to clients.
- Signed HS256 sessions with expiry.
- HttpOnly, SameSite=Lax, Secure-in-production cookies.
- No `localStorage` authentication.
- Zod validation on every request body.
- Parameterized MySQL queries only.
- Server-side role checks in the proxy and again in protected pages.
- Fresh database role lookup for page authorization.
- Generic login error for unknown identifiers and wrong passwords.
- Dummy bcrypt comparison for unknown users.
- In-memory login throttling.
- Origin check and JSON-only mutations.
- 32 KB JSON body limit.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, and `Permissions-Policy`.
- No database credentials or server-only modules imported into client
  components.
- Safe `next` redirect validation restricted to the authenticated role prefix.

---

## 13. Known limitations and follow-up

1. **Stateless sessions:** logout clears the cookie but cannot revoke an already
   copied JWT. Use a server-side session store if revocation is required.
2. **Process-local rate limiting:** limits reset when the Node.js process
   restarts and are not shared across multiple instances.
3. **No email verification:** the existing schema has no verification columns,
   so registration does not prove email ownership.
4. **Minimal profiles:** registration stores the required identity fields only.
   Full creator and brand profile editing belongs to a later phase.
5. **Dashboards are placeholders:** campaign, collaboration, payment, and review
   features are intentionally not implemented yet.
6. **In-memory limiter keys:** the proxy and route handlers rely on the platform's
   forwarded IP headers. Deployment should ensure trusted proxy headers are
   configured.

---

## 14. Files created and modified

### Created

- `src/lib/auth/constants.ts`
- `src/lib/auth/types.ts`
- `src/lib/auth/token.ts`
- `src/lib/auth/password.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/users.ts`
- `src/lib/auth/guards.ts`
- `src/lib/auth/errors.ts`
- `src/lib/auth/rate-limit.ts`
- `src/lib/auth/csrf.ts`
- `src/lib/auth/redirects.ts`
- `src/lib/validations/auth.ts`
- `src/lib/api/response.ts`
- `src/proxy.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/creator/dashboard/page.tsx`
- `src/app/brand/dashboard/page.tsx`
- `src/app/admin/dashboard/page.tsx`
- `src/app/forbidden/page.tsx`
- `src/app/globals.css`
- `src/components/auth/AuthShell.tsx`
- `src/components/auth/PasswordInput.tsx`
- `src/components/auth/LoginForm.tsx`
- `src/components/auth/RegisterForm.tsx`
- `src/components/auth/LogoutButton.tsx`
- `src/components/dashboard/RoleDashboard.tsx`
- `scripts/create-admin.ts`
- `scripts/test-auth.ts`
- `docs/AUTHENTICATION.md`

### Modified

- `src/app/layout.tsx` - metadata, viewport, global styles
- `src/app/page.tsx` - public landing page
- `next.config.ts` - security headers
- `package.json` - auth dependencies and scripts
- `package-lock.json` - dependency lockfile
- `.env.example` - auth/admin environment placeholders
- `.env` - local `AUTH_SECRET` only (ignored by Git; value not documented)
