# CreatorConnect - Database Seed and SQL Verification

**Phase:** Phase 2 - seed data preparation and SQL feature verification  
**Status:** Phase 2 executed and verified. Seed loaded; all checks PASS.  
**Prepared and executed:** 2026-11-01  
**Database:** `creatorconnect` (MySQL `8.0.46`, `lower_case_table_names=1`)  
**Seed loaded:** 259 rows across 15 tables

> **Execution record:** The project owner approved the seed. A pre-seed backup was
> created at `backups/creatorconnect_before_phase2_seed_20261101_225128.sql`
> (25,488 bytes), `database/02_seed_data.sql` committed successfully, and
> `03_basic_queries.sql`, `04_advanced_queries.sql`, and `05_verification.sql`
> were run against the seeded database with exit code 0.

---

## 1. Live schema inspection (read-only)

The live schema was inspected before writing the seed file. No schema or data
changes were made.

| Item | Verified result |
| --- | --- |
| Database | `creatorconnect` |
| MySQL version | `8.0.46` |
| `lower_case_table_names` | `1` |
| SQL mode | `ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION` |
| Autocommit | `1` |
| Base tables | 15 |
| Views | 1 - `campaign_creator_summary` |
| Foreign keys | 15 |
| CHECK constraints | 18 |
| Triggers | 2 |
| Stored procedures | 1 - `get_campaign_creators` |
| Current row counts | All 15 tables contain 0 rows |

### Foreign-key actions

- 14 foreign keys use `ON DELETE CASCADE ON UPDATE CASCADE`.
- `campaigns.category_id -> campaign_categories.category_id` uses
  `ON DELETE SET NULL ON UPDATE CASCADE`.

### Trigger logic inspected

`complete_collaboration_after_payment_insert`:

```sql
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    IF NEW.status = 'Paid' THEN
        UPDATE Collaborations
        SET status = 'Completed'
        WHERE collaboration_id = NEW.collaboration_id;
    END IF;
END
```

`update_collaboration_after_payment`:

```sql
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    IF NEW.status = 'Paid'
       AND OLD.status <> 'Paid' THEN
        UPDATE Collaborations
        SET status = 'Completed'
        WHERE collaboration_id = NEW.collaboration_id;
    END IF;
END
```

Consequences reflected in the seed design:

1. Collaborations are inserted as `Active`.
2. Paid payments are inserted afterwards; the insert trigger completes the
   associated collaborations.
3. Pending payments do not complete a collaboration.
4. A collaboration remains `Active` when it has only Pending payments.
5. The seed deliberately creates 12 Completed and 4 Active collaborations to
   demonstrate the trigger and both states.

---

## 2. Seed dataset

`database/02_seed_data.sql` contains realistic, interconnected data.

| Table | Rows | Notes |
| --- | ---: | --- |
| `users` | 14 | 1 Admin, 8 Creators, 5 Brands |
| `creators` | 8 | Profiles linked one-to-one to creator users |
| `creator_social_accounts` | 18 | Multiple Instagram, YouTube, and LinkedIn accounts |
| `brands` | 5 | Five brands across different industries |
| `campaign_categories` | 7 | Fashion, Technology, Travel, Fitness, Beauty, Food & Lifestyle, Finance & Education |
| `campaigns` | 11 | 5 Completed, 2 Ongoing, 4 Open |
| `campaign_requirements` | 17 | Platform and engagement requirements |
| `applications` | 34 | 16 Accepted, 6 Rejected, 12 Pending |
| `collaborations` | 16 | One per Accepted application; 12 become Completed via trigger |
| `deliverables` | 33 | Reels, Stories, Posts, and Videos |
| `content_submissions` | 35 | Approved, Rejected, and Pending submissions |
| `contracts` | 16 | One per collaboration |
| `payments` | 17 | 13 Paid payment rows, 4 Pending payment rows |
| `performance_metrics` | 16 | One metrics row per collaboration |
| `reviews` | 12 | Reviews for the 12 Completed collaborations |
| **Total** | **259** | |

### Deliberate data properties for query demonstrations

- Multiple creators per campaign and multiple campaigns per brand.
- A mixture of Accepted, Rejected, and Pending applications.
- Campaign budgets and collaboration commitments are within budget.
- All 16 collaborations have payments whose total equals the agreed amount.
- 12 collaborations have Paid payments and become Completed through the trigger.
- 4 collaborations have only Pending payments and remain Active.
- Content submissions include approved, rejected, and pending rows.
- Reviews have ratings from 3 to 5.
- Campaign, application, collaboration, and payment dates are internally
  consistent.

---

## 3. SQL files

| File | Purpose |
| --- | --- |
| `database/02_seed_data.sql` | Inserts all seed rows inside one transaction |
| `database/03_basic_queries.sql` | JOINs, GROUP BY, HAVING, aggregates, subqueries, view query |
| `database/04_advanced_queries.sql` | CTEs, recursive CTE, window functions, ROLLUP, JSON aggregation, stored procedure, read-only transaction demonstration |
| `database/05_verification.sql` | Row counts, object counts, FK integrity, uniqueness, constraints, triggers, view, procedure |

---

## 4. Execution order after approval

Do not run the checked-in `DDL STATEMENTS.sql`; it starts with `DROP DATABASE`.

### Step 1 - Optional safety backup

Use `mysqldump` with the MySQL client path and let it prompt for the password:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" `
  --host=127.0.0.1 --port=3306 --user=root `
  --single-transaction --routines --triggers `
  --databases creatorconnect `
  --result-file=creatorconnect_before_seed.sql
```

The password is entered interactively. Do not put the password on the command
line.

### Step 2 - Load the seed

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" `
  --host=127.0.0.1 --port=3306 --user=root `
  --database=creatorconnect `
  --execute="source database/02_seed_data.sql"
```

The script starts a transaction and commits only after every insert succeeds.
Do not use `--force`; an error should abort the transaction instead of allowing
a partial load.

### Step 3 - Run demonstration queries

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" `
  --host=127.0.0.1 --port=3306 --user=root `
  --database=creatorconnect `
  --table `
  --execute="source database/03_basic_queries.sql"
```

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" `
  --host=127.0.0.1 --port=3306 --user=root `
  --database=creatorconnect `
  --table `
  --execute="source database/04_advanced_queries.sql"
```

### Step 4 - Run verification

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" `
  --host=127.0.0.1 --port=3306 --user=root `
  --database=creatorconnect `
  --table `
  --execute="source database/05_verification.sql"
```

---

## 5. Idempotency and safety strategy

The seed script is safe to rerun:

- It never uses `DROP`, `TRUNCATE`, or `DELETE`.
- It never changes table structures or constraints.
- Every row has an explicit primary key.
- Every insert ends with `ON DUPLICATE KEY UPDATE <primary_key> = <primary_key>`.
  On a rerun, existing rows are left unchanged instead of being duplicated.
- Unique keys on usernames, emails, category names, and the relationship tables
  are also preserved because the same explicit IDs and values are reused.
- All inserts run inside `START TRANSACTION` / `COMMIT`.
- Parent tables are populated before child tables.
- The two payment triggers are accounted for; duplicate payment rows do not
  re-trigger a state change because the update trigger requires a transition
  from a non-Paid status to Paid.

Caveat: if the live database already contains unrelated rows with the same
primary or unique keys, the no-op strategy will skip those seed rows. Run
`database/05_verification.sql` and inspect any `FAIL` result before making
changes.

---

## 6. Pre-execution and execution validation

Before the seed was loaded, all SQL files were syntax-checked without changing
data. After approval, the seed and all query files were executed against the live
database.

| Validation | Result |
| --- | --- |
| Parsed seed file into 15 `INSERT` statements | PASS |
| `EXPLAIN` on all 15 `INSERT` statements | PASS - 15 plans returned, no syntax or column errors |
| Live row counts after `EXPLAIN` | All 15 tables still 0 rows |
| Pre-seed backup | PASS - `backups/creatorconnect_before_phase2_seed_20261101_225128.sql`, 25,488 bytes, dump completed |
| `02_seed_data.sql` execution | PASS - exit code 0, transaction committed |
| `03_basic_queries.sql` execution | PASS - exit code 0, output captured |
| `04_advanced_queries.sql` execution | PASS - exit code 0, output captured |
| `05_verification.sql` execution | PASS - exit code 0, every check PASS |
| Schema object checks from `05_verification.sql` | PASS - 15 tables, 1 view, 15 FKs, 2 triggers, 1 procedure, 18 checks |

Issue found during pre-execution validation:

- The alias `percent_rank` was rejected by MySQL as a reserved function name.
  It was renamed to `pct_rank`; `cume_dist` was renamed to
  `cumulative_distribution` for consistency. The advanced script then passed.

### Captured outputs

Raw UTF-8 output files are stored in `docs/phase2_outputs/`:

| File | Size | Outcome |
| --- | ---: | --- |
| `03_basic_queries.txt` | 26,018 bytes | Campaign, creator, application, brand, category, and view query results |
| `04_advanced_queries.txt` | 30,082 bytes | CTE, recursive CTE, window-function, ROLLUP, JSON, procedure, and transaction results |
| `05_verification.txt` | 17,516 bytes | All schema, row-count, integrity, constraint, trigger, view, and procedure checks PASS |

---

## 7. Actual post-seed results (2026-11-01)

`database/05_verification.sql` reported `PASS` for every check. Observed values
matched the expected values exactly:

| Check | Observed |
| --- | --- |
| Base tables / views / foreign keys | 15 / 1 / 15 |
| Triggers / procedures / CHECK constraints | 2 / 1 / 18 |
| `users` rows | 14 |
| `creators` rows | 8 |
| `creator_social_accounts` rows | 18 |
| `brands` rows | 5 |
| `campaign_categories` rows | 7 |
| `campaigns` rows | 11 |
| `campaign_requirements` rows | 17 |
| `applications` rows | 34 |
| `collaborations` rows | 16 |
| `deliverables` rows | 33 |
| `content_submissions` rows | 35 |
| `contracts` rows | 16 |
| `payments` rows | 17 |
| `performance_metrics` rows | 16 |
| `reviews` rows | 12 |
| Completed collaborations | 12 |
| Active collaborations | 4 |
| Completed collaborations without a Paid payment | 0 |
| Active collaborations with a Paid payment | 0 |
| `campaign_creator_summary` rows | 34 |
| View rows with collaboration | 16 |
| View rows without collaboration | 18 |
| FK orphan rows | 0 |
| Duplicate relationship rows | 0 |
| Constraint violations | 0 |

The stored procedure checks call `get_campaign_creators(1)` and
`get_campaign_creators(3)`; both returned 4 applicants, as expected.

### Query outcomes

- `03_basic_queries.sql` executed successfully. The captured output includes
  campaign overviews, creator earnings, campaign budgets, application details,
  and `campaign_creator_summary` results.
- `04_advanced_queries.sql` executed successfully. All CTEs, recursive CTE,
  window functions (`ROW_NUMBER`, `RANK`, `DENSE_RANK`, `NTILE`, `PERCENT_RANK`,
  `CUME_DIST`, `LAG`, `LEAD`), `ROLLUP`, JSON aggregation, stored procedure, and
  read-only transaction examples returned results.
- Collaboration 4 demonstrates two paid installments totaling `180000.00`; its
  payments correctly sum to the agreed amount.
- The procedure returned campaign 1 applicants Ananya Rao, Meera Iyer, Sneha
  Patel (Accepted) and Aditya Kulkarni (Rejected).
- The transaction demonstration counted 11 campaigns and 4 open campaigns.

### Important trigger limitation

The trigger completes a collaboration when any payment becomes Paid. It does
not verify that the total paid amount equals the agreed amount, and it does not
update the parent campaign status. The seed uses one full payment per
collaboration (except collaboration 4, which demonstrates two installments) and
sets campaign statuses explicitly. Future application logic must not assume that
partial payment is prevented by the database.

---

## 8. Current status and next action

**Current status:** Phase 2 is complete. The seed was loaded from
`database/02_seed_data.sql`, all 259 rows were verified, the trigger-driven
collaboration states are correct, and all checks in
`database/05_verification.sql` passed.

**Backup:** `backups/creatorconnect_before_phase2_seed_20261101_225128.sql`
(25,488 bytes) remains available for rollback; it must not be overwritten.

**Next action:** no database action is required. Use the captured outputs in
`docs/phase2_outputs/` for the project report or demonstration.
