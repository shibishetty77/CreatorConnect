# CreatorConnect - Schema Verification Report

> **Update (2026-11-01):** Live read-only verification has since been completed.
> See `docs/DATABASE_CONNECTION.md` for the current results. This document remains
> the historical Phase 0 record of the earlier blocked attempt.

**Phase:** Phase 0 - safe MySQL schema verification and reconciliation  
**Status:** **BLOCKED - live verification was not performed**  
**Generated:** 2026-10-27 08:55:29 +05:30 (Asia/Kolkata)  
**Database target:** `creatorconnect`  
**Mode:** Read-only verification intended; no database writes were made.

> **Bottom line:** The live database could not be inspected because `.env.local` is absent and none of the required database environment variables are set. The checked-in DDL and the 2026-08-28 screenshots disagree, so neither is treated as the current live schema. No live schema, trigger, procedure, view, or data claim is made in this report.

---

## Evidence labels

Every material finding below carries one of these labels:

| Label | Meaning |
| --- | --- |
| **VERIFIED LIVE** | Confirmed by a read-only query against the current `creatorconnect` server. **None in this report yet.** |
| **ARTIFACT** | Supported only by files in this repository or the local environment: checked-in DDL, PDF report, screenshots, ER diagrams, service status, or local Workbench metadata. |
| **UNRESOLVED** | No reliable current evidence. Must be verified live before application integration. |
| **BLOCKED** | Could not be checked because required local configuration is missing. |

Rows marked **ARTIFACT / UNRESOLVED LIVE** mean the artifact (DDL or screenshot) supports the observation, but the current live state has not been confirmed. They are not live findings.

---

## 1. Verification status and environment

### 1.1 Configuration check

| Item | Status | Evidence |
| --- | --- | --- |
| `.env.local` present | **Missing** | `Test-Path .env.local` returned `False`. |
| `DB_HOST` available | **Missing** | Not present in the process environment. |
| `DB_PORT` available | **Missing** | Not present in the process environment. |
| `DB_NAME` available | **Missing** | Not present in the process environment. |
| `DB_USER` available | **Missing** | Not present in the process environment. |
| `DB_PASSWORD` available | **Missing** | Not present in the process environment. |
| `.env.example` | **Present** | Placeholder-only template, ready to commit. `git check-ignore` evaluates the negation rule (`!.env.example`) and `git status` shows it as untracked rather than ignored. |
| `.gitignore` | **Present** | Ignores `.env`, `.env.*`, `.env.local`, `.env.*.local`; keeps `.env.example` via a negation rule. |
| MySQL Windows service | **Running locally** | `Get-Service MySQL80` returned `Running`. This is local environment evidence, not database connectivity. |
| MySQL client binary | **Present locally** | `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe` exists; `mysql` is not on `PATH`. |
| Live connection attempt | **Not made** | Required variables are absent. Credentials were not guessed. |

**Exact missing configuration:** `.env.local` with non-empty `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. `DB_NAME` is expected to be `creatorconnect`.

**Sensitive values printed:** None. No credentials, connection strings, password values, or user data appear in this report.

### 1.2 Server and database identity

| Item | Status | Finding |
| --- | --- | --- |
| Live MySQL version | **UNRESOLVED** | Not queried. Local Workbench metadata reports `8.0.46`, but that is **ARTIFACT** evidence, not a live `SELECT VERSION()`. |
| Live selected database | **UNRESOLVED** | Not queried. `creatorconnect` is the configured/default target from the task and the screenshot header. |
| Database name in screenshots | **ARTIFACT** | The 2026-08-28 `SHOW TABLES` screenshot is titled `Tables_in_creatorconnect`. |
| Character set/collation | **UNRESOLVED** | Not queried. |
| `lower_case_table_names` | **ARTIFACT** | Local `my.ini` shows `lower_case_table_names=1`, and screenshots show lowercase table names. Not confirmed live in this phase. |
| Live row counts | **UNRESOLVED** | Not queried. No user data was read. |

### 1.3 What was done

- Read `docs/IMPLEMENTATION_PLAN.md` (the Phase 0 plan and evidence rules).
- Read the checked-in `DDL STATEMENTS.sql`, including table definitions, ALTERs, indexes, triggers, procedure, and view.
- Extracted the text from `g11.pdf`; inspected the ER/schema screenshots and the two ER diagram images.
- Confirmed the local MySQL service is running and the client binary exists.
- Created `.gitignore` with local-env, Node, build, and test-artifact exclusions.
- Created `.env.example` with placeholder database variables only.
- Checked for `.env.local` and the five environment variables.
- **Stopped live verification** because the required configuration is missing, as instructed.

### 1.4 What was not done

- No authenticated connection was made to `creatorconnect` in this phase.
- No `SHOW CREATE TABLE`, `SHOW INDEX`, `SHOW TRIGGERS`, `SHOW PROCEDURE STATUS`, or `SHOW CREATE VIEW` was executed.
- No `information_schema` metadata query was executed.
- No row counts or sample data were read.
- No `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, or privilege change was executed.
- `DDL STATEMENTS.sql` was **not** run.

---

## 2. Tables found and missing

### 2.1 Expected tables

The project expects these 15 tables:

1. `users`
2. `creators`
3. `creator_social_accounts`
4. `brands`
5. `campaign_categories`
6. `campaigns`
7. `campaign_requirements`
8. `applications`
9. `collaborations`
10. `deliverables`
11. `content_submissions`
12. `contracts`
13. `payments`
14. `performance_metrics`
15. `reviews`

### 2.2 Current status

| Finding | Status | Evidence |
| --- | --- | --- |
| All 15 expected tables were present on 2026-08-28 | **ARTIFACT** | `PICS/Screenshot 2026-08-28 155316.png` shows `SHOW TABLES` with all 15 names. |
| All 15 tables exist in the current live database | **UNRESOLVED** | No live connection. |
| Extra tables/views exist now | **UNRESOLVED** | The old screenshot shows only 15 base tables; `SHOW FULL TABLES` was not run. |
| Table engine, charset, collation, row format | **UNRESOLVED** | No `SHOW CREATE TABLE` output. |
| Table names/case now | **UNRESOLVED** | Lowercase names are expected from local `lower_case_table_names=1` and the screenshot, but not confirmed live. |

The screenshot is dated **2026-08-28**, while the checked-in DDL was last modified **2026-10-04**. The screenshot is historical evidence, not a substitute for the current live schema.

---

## 3. Column-level findings

### 3.1 High-priority discrepancies requested for investigation

The following are real disagreements between two artifact sources. They are **not** resolved by choosing one source.

| Area | Checked-in DDL | 2026-08-28 screenshot | Live status |
| --- | --- | --- | --- |
| `creators` phone column | `phone VARCHAR(15)` | `phone_no VARCHAR(15)` | **UNRESOLVED** |
| `creators` street/address | `address VARCHAR(255)` | `street VARCHAR(100)` | **UNRESOLVED** |
| `creators.zip` | Not present | `zip VARCHAR(10)` | **UNRESOLVED** |
| `creators` picture column | `profile_picture_url VARCHAR(500)` via ALTER | `profile_picture VARCHAR(255)` | **UNRESOLVED** |
| `campaigns` capacity column | `creator_limit INT DEFAULT 1` via ALTER | `max_creators INT DEFAULT 10` | **UNRESOLVED** |
| `campaigns.category_id` nullability | Nullable in the DDL | `NULL = NO` in the screenshot | **UNRESOLVED** |
| `contracts.contract_document` | Present (`VARCHAR(500)`) | Absent from `DESC contracts` | **UNRESOLVED** |
| `payments.transaction_reference` | Present (`VARCHAR(100)`) | Absent from `DESC payments` | **UNRESOLVED** |

**Conclusion:** These must be resolved with live `SHOW CREATE TABLE` output. The live database is authoritative for application integration. The DDL must not be altered to match, and the live database must not be altered to match the DDL without explicit approval.

### 3.2 Complete column-observation comparison

The "screenshot" column below is limited to what the 2026-08-28 `DESC` screenshots visibly show. `DESC` does not show foreign keys, checks, or complete unique-constraint composition.

#### `users`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `user_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `username VARCHAR(50) NOT NULL UNIQUE` | `varchar(50)`, `NO`, `UNI` | **ARTIFACT / UNRESOLVED LIVE** |
| `email VARCHAR(100) NOT NULL UNIQUE` | `varchar(100)`, `NO`, `UNI` | **ARTIFACT / UNRESOLVED LIVE** |
| `password_hash VARCHAR(255) NOT NULL` | `varchar(255)`, `NO` | **ARTIFACT / UNRESOLVED LIVE** |
| `role ENUM('Admin','Brand','Creator') NOT NULL` | Same enum, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` | `timestamp`, `YES`, default `CURRENT_TIMESTAMP` | **ARTIFACT / UNRESOLVED LIVE** |

#### `creators`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `creator_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `user_id INT NOT NULL UNIQUE` | `int`, `NO`, `UNI` | **ARTIFACT / UNRESOLVED LIVE** |
| `first_name VARCHAR(50) NOT NULL` | `varchar(50)`, `NO` | **ARTIFACT / UNRESOLVED LIVE** |
| No `middle_name` column | `middle_name VARCHAR(50)`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `last_name VARCHAR(50) NOT NULL` | `varchar(50)`, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `date_of_birth DATE` (nullable) | `date_of_birth DATE`, `NO` | **ARTIFACT / UNRESOLVED LIVE** |
| `phone VARCHAR(15)` | `phone_no VARCHAR(15)`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `bio TEXT` | `bio TEXT`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `address VARCHAR(255)` | `street VARCHAR(100)`, `YES`; plus `city`, `state`, `zip(10)` | **ARTIFACT / UNRESOLVED LIVE** |
| No `zip` column | `zip VARCHAR(10)`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `profile_picture_url VARCHAR(500)` via ALTER | `profile_picture VARCHAR(255)`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |

#### `creator_social_accounts`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `account_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `creator_id INT NOT NULL` | `int`, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `platform ENUM('Instagram','YouTube','LinkedIn','Twitter','Facebook') NOT NULL` | Same enum, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `username VARCHAR(100) NOT NULL` | `varchar(100)`, `NO` | **ARTIFACT / UNRESOLVED LIVE** |
| `followers BIGINT DEFAULT 0` | `int`, `YES`, default `0` | **ARTIFACT / UNRESOLVED LIVE** |
| `engagement_rate DECIMAL(5,2) DEFAULT 0.00` | `decimal(5,2)`, `YES`, default `NULL` | **ARTIFACT / UNRESOLVED LIVE** |
| `account_url VARCHAR(255)` | `varchar(255)`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| No unique constraint on `(creator_id, platform)` | `DESC` cannot prove absence; no unique marker on `platform` beyond `MUL` | **UNRESOLVED** |
| Checks `followers >= 0`, `engagement_rate BETWEEN 0 AND 100` | Not visible in `DESC` | **UNRESOLVED** |

#### `brands`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `brand_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `user_id INT NOT NULL UNIQUE` | `int`, `NO`, `UNI` | **ARTIFACT / UNRESOLVED LIVE** |
| `brand_name VARCHAR(150) NOT NULL` | `varchar(100)`, `NO` | **ARTIFACT / UNRESOLVED LIVE** |
| `industry VARCHAR(100)` | `varchar(50)`, `YES`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `contact_number VARCHAR(15)` | `contact_person VARCHAR(100)`, `YES`; `phone_no VARCHAR(15)`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `address VARCHAR(255)` | `street VARCHAR(100)`, `YES`; plus `city(50)`, `state(50)`, `zip(10)` | **ARTIFACT / UNRESOLVED LIVE** |
| `city VARCHAR(100)`, `state VARCHAR(100)` | `city VARCHAR(50)`, `state VARCHAR(50)` | **ARTIFACT / UNRESOLVED LIVE** |
| No `zip` column | `zip VARCHAR(10)`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |

#### `campaign_categories`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `category_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `category_name VARCHAR(100) NOT NULL UNIQUE` | `varchar(50)`, `NO`, `UNI` | **ARTIFACT / UNRESOLVED LIVE** |
| `description VARCHAR(255)` | Column absent | **ARTIFACT / UNRESOLVED LIVE** |

#### `campaigns`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `campaign_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `brand_id INT NOT NULL` | `int`, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `category_id INT` (nullable) | `int`, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `campaign_name VARCHAR(150) NOT NULL` | `varchar(100)`, `NO` | **ARTIFACT / UNRESOLVED LIVE** |
| `description TEXT` | `text`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `budget DECIMAL(12,2) NOT NULL` | `decimal(12,2)`, `NO` | **ARTIFACT / UNRESOLVED LIVE** |
| `min_followers BIGINT DEFAULT 0` | `int`, `YES`, default `0` | **ARTIFACT / UNRESOLVED LIVE** |
| `start_date DATE NOT NULL` | `date`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `end_date DATE NOT NULL` | `date`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `status ENUM('Open','Ongoing','Completed') DEFAULT 'Open'` | Same enum, `YES`, default `Open` | **ARTIFACT / UNRESOLVED LIVE** |
| `creator_limit INT DEFAULT 1` via ALTER | `max_creators INT`, `YES`, default `10` | **ARTIFACT / UNRESOLVED LIVE** |

#### `campaign_requirements`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `requirement_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `campaign_id INT NOT NULL` | `int`, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `platform ENUM(...) NOT NULL` | Same enum, `YES` (nullable) | **ARTIFACT / UNRESOLVED LIVE** |
| `required_niche VARCHAR(100)` | `varchar(50)`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `min_engagement_rate DECIMAL(5,2) DEFAULT 0.00` | `decimal(5,2)`, `YES`, default `NULL` | **ARTIFACT / UNRESOLVED LIVE** |
| Check `min_engagement_rate BETWEEN 0 AND 100` | Not visible in `DESC` | **UNRESOLVED** |

#### `applications`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `application_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `campaign_id INT NOT NULL` | `int`, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `creator_id INT NOT NULL` | `int`, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `applied_date DATE DEFAULT (CURRENT_DATE)` | `date`, `YES`, default `curdate()`, `DEFAULT_GENERATED` | **ARTIFACT / UNRESOLVED LIVE** |
| `status ENUM('Pending','Accepted','Rejected') DEFAULT 'Pending'` | Same enum, `YES`, default `Pending`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| Unique `(campaign_id, creator_id)` | `DESC` cannot prove composition or existence; both columns show `MUL` | **UNRESOLVED** |

#### `collaborations`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `collaboration_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `application_id INT NOT NULL UNIQUE` | `int`, `NO`, `UNI` | **ARTIFACT / UNRESOLVED LIVE** |
| `agreed_amount DECIMAL(12,2) NOT NULL` | `decimal(12,2)`, `YES` (nullable) | **ARTIFACT / UNRESOLVED LIVE** |
| `start_date DATE NOT NULL` | `date`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `end_date DATE NOT NULL` | `date`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `status ENUM('Active','Completed') DEFAULT 'Active'` | Same enum, `YES`, default `Active` | **ARTIFACT / UNRESOLVED LIVE** |

#### `deliverables`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `deliverable_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `collaboration_id INT NOT NULL` | `int`, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `content_type ENUM('Reel','Story','Post','Video') NOT NULL` | Same enum, `YES` (nullable) | **ARTIFACT / UNRESOLVED LIVE** |
| `due_date DATE NOT NULL` | `date`, `YES` (nullable) | **ARTIFACT / UNRESOLVED LIVE** |
| `status ENUM('Pending','Completed') DEFAULT 'Pending'` | Same enum, `YES`, default `Pending` | **ARTIFACT / UNRESOLVED LIVE** |

#### `content_submissions`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `submission_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `deliverable_id INT NOT NULL` | `int`, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `content_url VARCHAR(500) NOT NULL` | `varchar(255)`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `submitted_date DATE DEFAULT (CURRENT_DATE)` | `date`, `YES`, default `curdate()`, `DEFAULT_GENERATED` | **ARTIFACT / UNRESOLVED LIVE** |
| `approval_status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending'` | Same enum, `YES`, default `Pending` | **ARTIFACT / UNRESOLVED LIVE** |

#### `contracts`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `contract_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `collaboration_id INT NOT NULL UNIQUE` | `int`, `NO`, `UNI` | **ARTIFACT / UNRESOLVED LIVE** |
| `signed_date DATE` | `date`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `expiry_date DATE` | `date`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `contract_document VARCHAR(500)` | Column absent | **ARTIFACT / UNRESOLVED LIVE** |

#### `payments`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `payment_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `collaboration_id INT NOT NULL` | `int`, `NO`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `amount DECIMAL(12,2) NOT NULL` | `decimal(12,2)`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `payment_date DATE` | `date`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `status ENUM('Pending','Paid') DEFAULT 'Pending'` | Same enum, `YES`, default `Pending`, key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `transaction_reference VARCHAR(100)` | Column absent | **ARTIFACT / UNRESOLVED LIVE** |

#### `performance_metrics`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `metric_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `collaboration_id INT NOT NULL UNIQUE` | `int`, `NO`, `UNI` | **ARTIFACT / UNRESOLVED LIVE** |
| `views`, `likes`, `comments`, `shares`, `clicks` `BIGINT DEFAULT 0` | Each is `int`, `YES`, default `0` | **ARTIFACT / UNRESOLVED LIVE** |
| Checks that each metric `>= 0` | Not visible in `DESC` | **UNRESOLVED** |

#### `reviews`

| Checked-in DDL | Screenshot evidence | Status |
| --- | --- | --- |
| `review_id INT AUTO_INCREMENT PK` | `int`, `NO`, `PRI`, auto_increment | **ARTIFACT / UNRESOLVED LIVE** |
| `collaboration_id INT NOT NULL UNIQUE` | `int`, `NO`, `UNI` | **ARTIFACT / UNRESOLVED LIVE** |
| `rating INT NOT NULL` | `int`, `YES` (nullable), key `MUL` | **ARTIFACT / UNRESOLVED LIVE** |
| `feedback TEXT` | `text`, `YES` | **ARTIFACT / UNRESOLVED LIVE** |
| `review_date DATE DEFAULT (CURRENT_DATE)` | `date`, `YES`, default `curdate()`, `DEFAULT_GENERATED` | **ARTIFACT / UNRESOLVED LIVE** |
| Check `rating BETWEEN 1 AND 5` | Not visible in `DESC` | **UNRESOLVED** |

### 3.3 Column-level reconciliation status

| Question | Answer |
| --- | --- |
| Does the live `creators` table use `phone_no` or `phone`? | **UNRESOLVED.** Screenshot says `phone_no`; DDL says `phone`. |
| Does the live `creators` table use `street` or `address`? | **UNRESOLVED.** Screenshot says `street`; DDL says `address`. |
| Does the live `creators` table have `zip`? | **UNRESOLVED.** Screenshot says yes; DDL does not. |
| Is the live picture column `profile_picture` or `profile_picture_url`? | **UNRESOLVED.** Screenshot says `profile_picture`; DDL says `profile_picture_url`. |
| Does the live `campaigns` table use `max_creators` or `creator_limit`? | **UNRESOLVED.** Screenshot says `max_creators`; DDL says `creator_limit`. |
| Is live `campaigns.category_id` nullable? | **UNRESOLVED.** Screenshot says `NO`; DDL says nullable. |
| Does live `contracts` have `contract_document`? | **UNRESOLVED.** Screenshot says no; DDL says yes. |
| Does live `payments` have `transaction_reference`? | **UNRESOLVED.** Screenshot says no; DDL says yes. |

---

## 4. Constraints, indexes, and relationship findings

### 4.1 Checked-in DDL definitions (ARTIFACT only)

These are what the SQL file says. They are not confirmed live.

| Table | Primary key | Foreign keys / actions per DDL | Unique constraints per DDL | Checks per DDL |
| --- | --- | --- | --- | --- |
| `users` | `user_id` | None | `username`, `email` | None |
| `creators` | `creator_id` | `user_id -> users(user_id)` `ON DELETE CASCADE ON UPDATE CASCADE` | `user_id` | None |
| `creator_social_accounts` | `account_id` | `creator_id -> creators(creator_id)` `ON DELETE CASCADE ON UPDATE CASCADE` | None | `followers >= 0`; `engagement_rate BETWEEN 0 AND 100` |
| `brands` | `brand_id` | `user_id -> users(user_id)` `ON DELETE CASCADE ON UPDATE CASCADE` | `user_id` | None |
| `campaign_categories` | `category_id` | None | `category_name` | None |
| `campaigns` | `campaign_id` | `brand_id -> brands(brand_id)` `ON DELETE CASCADE`; `category_id -> campaign_categories(category_id)` `ON DELETE SET NULL` | None | `budget > 0`; `min_followers >= 0`; `end_date >= start_date`; `creator_limit > 0` |
| `campaign_requirements` | `requirement_id` | `campaign_id -> campaigns(campaign_id)` `ON DELETE CASCADE` | None | `min_engagement_rate BETWEEN 0 AND 100` |
| `applications` | `application_id` | `campaign_id -> campaigns(campaign_id)` `ON DELETE CASCADE`; `creator_id -> creators(creator_id)` `ON DELETE CASCADE` | `(campaign_id, creator_id)` | None |
| `collaborations` | `collaboration_id` | `application_id -> applications(application_id)` `ON DELETE CASCADE` | `application_id` | `agreed_amount >= 0`; `end_date >= start_date` |
| `deliverables` | `deliverable_id` | `collaboration_id -> collaborations(collaboration_id)` `ON DELETE CASCADE` | None | None |
| `content_submissions` | `submission_id` | `deliverable_id -> deliverables(deliverable_id)` `ON DELETE CASCADE` | None | None |
| `contracts` | `contract_id` | `collaboration_id -> collaborations(collaboration_id)` `ON DELETE CASCADE` | `collaboration_id` | `expiry_date IS NULL OR signed_date IS NULL OR expiry_date >= signed_date` |
| `payments` | `payment_id` | `collaboration_id -> collaborations(collaboration_id)` `ON DELETE CASCADE` | None | `amount >= 0` |
| `performance_metrics` | `metric_id` | `collaboration_id -> collaborations(collaboration_id)` `ON DELETE CASCADE` | `collaboration_id` | Every metric `>= 0` |
| `reviews` | `review_id` | `collaboration_id -> collaborations(collaboration_id)` `ON DELETE CASCADE` | `collaboration_id` | `rating BETWEEN 1 AND 5` |

### 4.2 DDL indexes (ARTIFACT only)

The checked-in DDL creates these indexes:

`idx_users_role`, `idx_creators_last_name`, `idx_creators_city`, `idx_social_platform`, `idx_social_followers`, `idx_brands_industry`, `idx_brands_city`, `idx_campaign_name`, `idx_campaign_status`, `idx_campaign_dates`, `idx_campaign_brand`, `idx_campaign_category`, `idx_application_status`, `idx_application_campaign`, `idx_application_creator`, `idx_collaboration_status`, `idx_payment_status`, `idx_payment_date`, `idx_review_rating`.

### 4.3 Screenshot key observations (ARTIFACT only)

| Observation | Status | Notes |
| --- | --- | --- |
| `user_id` shows `UNI` on `creators` and `brands` | **ARTIFACT** | Consistent with one profile per user; exact constraint name unresolved. |
| `collaboration_id` shows `UNI` on `contracts`, `performance_metrics`, `reviews` | **ARTIFACT** | Consistent with one row per collaboration; exact constraint name unresolved. |
| `application_id` shows `UNI` on `collaborations` | **ARTIFACT** | Consistent with one collaboration per application. |
| `applications.campaign_id` and `applications.creator_id` show `MUL` | **ARTIFACT** | Could be separate indexes or columns of a composite unique constraint; composition unresolved. |
| `status` columns show `MUL` | **ARTIFACT** | Indexes exist; names/definitions unresolved. |
| `creators.last_name`, `creators.city` show `MUL` | **ARTIFACT** | Indexes exist; names unresolved. |
| `creator_social_accounts.platform` shows `MUL` | **ARTIFACT** | An index exists; whether a unique `(creator_id, platform)` constraint exists is unresolved. |
| Foreign key actions and cascade rules | **UNRESOLVED** | `DESC` does not show them. |
| CHECK constraints | **UNRESOLVED** | `DESC` does not show them. |
| Full index composition and names | **UNRESOLVED** | `SHOW INDEX` was not run. |

**Important distinction:** the DDL and the screenshot both contain evidence of keys, but neither proves the live constraint definitions. The live `information_schema` and `SHOW CREATE TABLE` output are required.

---

## 5. Trigger, procedure, and view verification

| Object | Expected from checked-in DDL | Screenshot evidence | Live verification | Status |
| --- | --- | --- | --- | --- |
| `update_collaboration_after_payment` | `AFTER UPDATE ON payments`: when status changes to `Paid`, set the collaboration `Completed`. | Not visible in screenshots. | Not run. | **UNRESOLVED** |
| `complete_collaboration_after_payment_insert` | `AFTER INSERT ON payments`: when a new payment has `Paid`, set the collaboration `Completed`. | Not visible in screenshots. | Not run. | **UNRESOLVED** |
| `get_campaign_creators` | Stored procedure accepting `p_campaign_id` and returning creators/applications for a campaign. | Not visible in screenshots. | Not run. | **UNRESOLVED** |
| `campaign_creator_summary` | View joining campaigns, applications, creators, and collaborations. | Not visible in screenshots. | Not run. | **UNRESOLVED** |

**Consequence of missing objects:** the application cannot assume the triggers, procedure, or view exist. If they are absent, the service layer must implement equivalent behavior and the admin system page must report the missing object. Creating them is an additive database change and requires explicit approval.

**Trigger business-rule risk:** if the live triggers match the DDL, marking any single payment `Paid` completes the whole collaboration. Partial or milestone payments would therefore produce misleading status. This is a business-rule decision, not just an implementation detail.

---

## 6. Features supported by the verified schema

### 6.1 Verified live

**None.** No feature can be declared supported by the live schema until the read-only queries run successfully.

### 6.2 Conditionally supported by screenshot evidence (ARTIFACT only)

These features appear feasible **if** the current live schema matches the 2026-08-28 screenshots:

| Feature | Conditional support | Constraint/limitation |
| --- | --- | --- |
| Registration/login and roles | Yes | `users` fields and role enum are visible. Password hashing is an application concern. |
| Creator profile | Yes | Use `phone_no`, `street`, `zip`, `profile_picture`; `date_of_birth` appears `NOT NULL`. |
| Creator social accounts | Yes | `followers` is `INT`; `engagement_rate` is nullable; duplicate platforms are not prevented by a visible unique constraint. |
| Brand profile | Yes | Use `contact_person`, `phone_no`, `street`, `zip`; lengths differ from the DDL. |
| Campaign create/edit/discovery | Yes | Use `max_creators`; `category_id` appears `NOT NULL`; dates are nullable in the artifact and must be validated by the app. |
| Campaign requirements | Yes | `platform` and engagement are nullable; `required_niche` is only 50 characters. |
| Applications and acceptance | Yes, with verification | Live uniqueness and capacity behavior are unresolved. |
| Collaborations | Yes | `agreed_amount` and dates are nullable in the artifact; validate on write. |
| Deliverables and submissions | Yes | Content type and due date are nullable; URL is 255 characters and nullable in the artifact. |
| Contracts | Partial | Only signed/expiry dates are visible; no document column. |
| Payments | Partial | No transaction reference; trigger semantics unresolved. |
| Performance metrics | Yes | Values are `INT`; one row per collaboration. |
| Reviews | Partial | One row per collaboration, no reviewer identity, rating appears nullable. |
| Admin reports | Conditional | Depends on the view/procedure and live aggregates. |

### 6.3 Conditionally supported if the live schema matches the checked-in DDL instead

| Feature | Conditional difference |
| --- | --- |
| Creator profile | `phone`, `address`, `profile_picture_url`; no `middle_name`/`zip`. |
| Campaign capacity | `creator_limit` default 1 instead of `max_creators` default 10. |
| Campaign category | `category_id` nullable. |
| Contracts | `contract_document` exists. |
| Payments | `transaction_reference` exists. |
| Social followers/metrics | `BIGINT` instead of `INT`. |

The application must not try to support both shapes by blindly selecting all columns. It must use the verified live column names through a single capability map.

### 6.4 Features that require an approved schema change

Regardless of which artifact is closer, these requested capabilities are not fully supported by either observed shape:

| Feature | Why a change is needed |
| --- | --- |
| True campaign draft vs published | The only statuses are `Open`, `Ongoing`, `Completed`. There is no draft/published flag. |
| Creator-niche matching | No creator niche column exists; `required_niche` cannot be matched reliably. |
| Two-sided reviews with reviewer identity | `reviews` has no `reviewer_user_id` or reviewer role. |
| Contract document storage | The observed screenshot schema has no `contract_document`; the DDL does. Live status unresolved. |
| Payment transaction reference | The observed screenshot schema has no `transaction_reference`; the DDL does. Live status unresolved. |
| Partial/milestone payments | The expected triggers complete the collaboration on any `Paid` payment. This needs a business-rule or trigger change. |
| Optional social-account uniqueness | No visible unique `(creator_id, platform)` constraint; enforce in the app or add a constraint with approval. |
| Optional category descriptions | Present in the DDL, absent in the screenshot. Live status unresolved. |

**Policy:** do not alter the live database to match the DDL. Any additive change must be separately proposed, approved, tested on a test database, and documented.

---

## 7. Blockers and next actions

### 7.1 Blockers

1. **Missing local database configuration (critical).**  
   `.env.local` does not exist, and `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` are not set in the process environment. Live verification cannot proceed.

2. **Current live schema unknown (critical).**  
   The checked-in DDL and the 2026-08-28 screenshots disagree on multiple columns, types, nullability, capacity, and optional fields. Neither can be treated as authoritative.

3. **Database objects unverified (high).**  
   The two payment triggers, `get_campaign_creators`, and `campaign_creator_summary` are defined in the DDL but cannot be confirmed live.

4. **Constraints and cascade rules unverified (high).**  
   `DESC` screenshots do not show foreign keys, checks, complete unique constraints, index composition, or `ON DELETE` actions.

5. **Business-rule decisions still pending (high).**  
   Draft/publish, partial payments, reviewer identity, creator niche, contract documents, and payment references need product decisions and, in some cases, approved additive schema changes.

6. **Current data volume unknown (medium).**  
   No row counts were read. This affects seed/test planning and migration risk, though no data will be modified.

### 7.2 Next actions

1. Create `.env.local` locally using `.env.example` as the template. Fill in all five variables with a **read-only** MySQL account if available. Do not paste credentials into chat or commit the file. A least-privilege account with `SELECT` and metadata visibility is sufficient for Phase 0.
2. Confirm `.env.local` is ignored:
   ```text
   git check-ignore -v .env.local
   ```
3. Run the read-only verification commands from `docs/IMPLEMENTATION_PLAN.md` section 2.5, or the equivalent metadata queries:
   - `SELECT VERSION()`, `SELECT DATABASE()`
   - `SHOW TABLES`
   - `SHOW CREATE TABLE` for all 15 tables
   - `SHOW INDEX FROM` each table
   - `SHOW TRIGGERS`
   - `SHOW PROCEDURE STATUS WHERE Db = 'creatorconnect'`
   - `SHOW CREATE PROCEDURE get_campaign_creators`
   - `SHOW FULL TABLES WHERE Table_type = 'VIEW'`
   - `SHOW CREATE VIEW campaign_creator_summary`
   - `information_schema` column, key, and foreign-key queries
4. Update this report: replace **UNRESOLVED** labels with **VERIFIED LIVE** evidence for every confirmed item; keep artifact evidence separate.
5. Record the exact live names and types for the eight high-priority discrepancies in section 3.1.
6. Verify object existence and trigger behavior. Do not create missing objects without approval.
7. Resolve the business-rule decisions listed in section 6.4.
8. Only then proceed to Phase 1. Do not scaffold Next.js or write repositories before this report has live evidence.

### 7.3 Exact missing configuration

To unblock Phase 0, the following must exist locally:

```text
<repository-root>\.env.local
```

with these five non-empty variables:

```text
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
```

No password or secret should be included in this report, the chat, or any committed file.

---

## 8. Summary

| Question | Answer |
| --- | --- |
| Was live MySQL connectivity verified? | **No.** Required configuration is missing. |
| Was the live schema verified? | **No.** |
| Were triggers, procedure, or view verified? | **No.** |
| Was any data read or modified? | **No.** |
| Were repository artifacts inspected? | **Yes.** DDL, PDF text, screenshots, ER diagrams, local service status. |
| Is the checked-in DDL authoritative? | **No.** It is one artifact and it disagrees with the screenshots. |
| Are the screenshots authoritative for the current database? | **No.** They are dated 2026-08-28 and are historical evidence. |
| Can Phase 1 start? | **No.** Phase 0 is blocked until live verification is complete. |

**Exact next step:** configure `.env.local` with the five variables using a local read-only MySQL account, then rerun the read-only verification and update this report.
