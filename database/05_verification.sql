-- ============================================================
-- CreatorConnect - Phase 2 verification
-- Database: creatorconnect
--
-- Run after database/02_seed_data.sql has been approved and executed.
-- Expected values assume the seed was loaded into the originally empty
-- database exactly once. If pre-existing rows use the same IDs, inspect
-- any FAIL row before taking action.
-- ============================================================

USE creatorconnect;

-- ------------------------------------------------------------
-- 0. Connection and database identity
-- ------------------------------------------------------------
SELECT
    DATABASE() AS current_database,
    VERSION() AS mysql_version,
    @@lower_case_table_names AS lower_case_table_names;

-- ------------------------------------------------------------
-- 1. Schema object counts
-- ------------------------------------------------------------
WITH object_checks AS (
    SELECT
        'base_tables' AS check_name,
        COUNT(*) AS actual_count,
        15 AS expected_count
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
    UNION ALL
    SELECT
        'views',
        COUNT(*),
        1
    FROM information_schema.VIEWS
    WHERE TABLE_SCHEMA = DATABASE()
    UNION ALL
    SELECT
        'foreign_keys',
        COUNT(*),
        15
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
    UNION ALL
    SELECT
        'triggers',
        COUNT(*),
        2
    FROM information_schema.TRIGGERS
    WHERE TRIGGER_SCHEMA = DATABASE()
    UNION ALL
    SELECT
        'procedures',
        COUNT(*),
        1
    FROM information_schema.ROUTINES
    WHERE ROUTINE_SCHEMA = DATABASE()
      AND ROUTINE_TYPE = 'PROCEDURE'
    UNION ALL
    SELECT
        'check_constraints',
        COUNT(*),
        18
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND CONSTRAINT_TYPE = 'CHECK'
)
SELECT
    check_name,
    actual_count,
    expected_count,
    IF(actual_count = expected_count, 'PASS', 'FAIL') AS result
FROM object_checks
ORDER BY check_name;

-- ------------------------------------------------------------
-- 2. Row counts
-- ------------------------------------------------------------
WITH expected_row_counts AS (
    SELECT 'users' AS table_name, 14 AS expected_count
    UNION ALL SELECT 'creators', 8
    UNION ALL SELECT 'creator_social_accounts', 18
    UNION ALL SELECT 'brands', 5
    UNION ALL SELECT 'campaign_categories', 7
    UNION ALL SELECT 'campaigns', 11
    UNION ALL SELECT 'campaign_requirements', 17
    UNION ALL SELECT 'applications', 34
    UNION ALL SELECT 'collaborations', 16
    UNION ALL SELECT 'deliverables', 33
    UNION ALL SELECT 'content_submissions', 35
    UNION ALL SELECT 'contracts', 16
    UNION ALL SELECT 'payments', 17
    UNION ALL SELECT 'performance_metrics', 16
    UNION ALL SELECT 'reviews', 12
),
actual_row_counts AS (
    SELECT 'users' AS table_name, COUNT(*) AS actual_count FROM users
    UNION ALL SELECT 'creators', COUNT(*) FROM creators
    UNION ALL SELECT 'creator_social_accounts', COUNT(*) FROM creator_social_accounts
    UNION ALL SELECT 'brands', COUNT(*) FROM brands
    UNION ALL SELECT 'campaign_categories', COUNT(*) FROM campaign_categories
    UNION ALL SELECT 'campaigns', COUNT(*) FROM campaigns
    UNION ALL SELECT 'campaign_requirements', COUNT(*) FROM campaign_requirements
    UNION ALL SELECT 'applications', COUNT(*) FROM applications
    UNION ALL SELECT 'collaborations', COUNT(*) FROM collaborations
    UNION ALL SELECT 'deliverables', COUNT(*) FROM deliverables
    UNION ALL SELECT 'content_submissions', COUNT(*) FROM content_submissions
    UNION ALL SELECT 'contracts', COUNT(*) FROM contracts
    UNION ALL SELECT 'payments', COUNT(*) FROM payments
    UNION ALL SELECT 'performance_metrics', COUNT(*) FROM performance_metrics
    UNION ALL SELECT 'reviews', COUNT(*) FROM reviews
)
SELECT
    e.table_name,
    e.expected_count,
    COALESCE(a.actual_count, -1) AS actual_count,
    IF(COALESCE(a.actual_count, -1) = e.expected_count, 'PASS', 'FAIL') AS result
FROM expected_row_counts AS e
LEFT JOIN actual_row_counts AS a
    ON a.table_name = e.table_name
ORDER BY e.table_name;

-- ------------------------------------------------------------
-- 3. Expected base tables present
-- ------------------------------------------------------------
WITH expected_tables AS (
    SELECT 'users' AS table_name
    UNION ALL SELECT 'creators'
    UNION ALL SELECT 'creator_social_accounts'
    UNION ALL SELECT 'brands'
    UNION ALL SELECT 'campaign_categories'
    UNION ALL SELECT 'campaigns'
    UNION ALL SELECT 'campaign_requirements'
    UNION ALL SELECT 'applications'
    UNION ALL SELECT 'collaborations'
    UNION ALL SELECT 'deliverables'
    UNION ALL SELECT 'content_submissions'
    UNION ALL SELECT 'contracts'
    UNION ALL SELECT 'payments'
    UNION ALL SELECT 'performance_metrics'
    UNION ALL SELECT 'reviews'
)
SELECT
    e.table_name,
    IF(t.TABLE_NAME IS NULL, 'MISSING', 'PRESENT') AS result
FROM expected_tables AS e
LEFT JOIN information_schema.TABLES AS t
    ON t.TABLE_SCHEMA = DATABASE()
   AND t.TABLE_NAME = e.table_name
   AND t.TABLE_TYPE = 'BASE TABLE'
ORDER BY e.table_name;

-- ------------------------------------------------------------
-- 4. Foreign-key orphan checks (all should return 0)
-- ------------------------------------------------------------
SELECT 'brands.user_id -> users.user_id' AS relationship, COUNT(*) AS orphan_count
FROM brands AS b
LEFT JOIN users AS u ON u.user_id = b.user_id
WHERE u.user_id IS NULL
UNION ALL
SELECT 'creators.user_id -> users.user_id', COUNT(*)
FROM creators AS c
LEFT JOIN users AS u ON u.user_id = c.user_id
WHERE u.user_id IS NULL
UNION ALL
SELECT 'creator_social_accounts.creator_id -> creators.creator_id', COUNT(*)
FROM creator_social_accounts AS csa
LEFT JOIN creators AS c ON c.creator_id = csa.creator_id
WHERE c.creator_id IS NULL
UNION ALL
SELECT 'campaigns.brand_id -> brands.brand_id', COUNT(*)
FROM campaigns AS c
LEFT JOIN brands AS b ON b.brand_id = c.brand_id
WHERE b.brand_id IS NULL
UNION ALL
SELECT 'campaigns.category_id -> campaign_categories.category_id', COUNT(*)
FROM campaigns AS c
LEFT JOIN campaign_categories AS cc ON cc.category_id = c.category_id
WHERE c.category_id IS NOT NULL
  AND cc.category_id IS NULL
UNION ALL
SELECT 'campaign_requirements.campaign_id -> campaigns.campaign_id', COUNT(*)
FROM campaign_requirements AS req
LEFT JOIN campaigns AS c ON c.campaign_id = req.campaign_id
WHERE c.campaign_id IS NULL
UNION ALL
SELECT 'applications.campaign_id -> campaigns.campaign_id', COUNT(*)
FROM applications AS a
LEFT JOIN campaigns AS c ON c.campaign_id = a.campaign_id
WHERE c.campaign_id IS NULL
UNION ALL
SELECT 'applications.creator_id -> creators.creator_id', COUNT(*)
FROM applications AS a
LEFT JOIN creators AS c ON c.creator_id = a.creator_id
WHERE c.creator_id IS NULL
UNION ALL
SELECT 'collaborations.application_id -> applications.application_id', COUNT(*)
FROM collaborations AS co
LEFT JOIN applications AS a ON a.application_id = co.application_id
WHERE a.application_id IS NULL
UNION ALL
SELECT 'deliverables.collaboration_id -> collaborations.collaboration_id', COUNT(*)
FROM deliverables AS d
LEFT JOIN collaborations AS co ON co.collaboration_id = d.collaboration_id
WHERE co.collaboration_id IS NULL
UNION ALL
SELECT 'content_submissions.deliverable_id -> deliverables.deliverable_id', COUNT(*)
FROM content_submissions AS cs
LEFT JOIN deliverables AS d ON d.deliverable_id = cs.deliverable_id
WHERE d.deliverable_id IS NULL
UNION ALL
SELECT 'contracts.collaboration_id -> collaborations.collaboration_id', COUNT(*)
FROM contracts AS ct
LEFT JOIN collaborations AS co ON co.collaboration_id = ct.collaboration_id
WHERE co.collaboration_id IS NULL
UNION ALL
SELECT 'payments.collaboration_id -> collaborations.collaboration_id', COUNT(*)
FROM payments AS p
LEFT JOIN collaborations AS co ON co.collaboration_id = p.collaboration_id
WHERE co.collaboration_id IS NULL
UNION ALL
SELECT 'performance_metrics.collaboration_id -> collaborations.collaboration_id', COUNT(*)
FROM performance_metrics AS pm
LEFT JOIN collaborations AS co ON co.collaboration_id = pm.collaboration_id
WHERE co.collaboration_id IS NULL
UNION ALL
SELECT 'reviews.collaboration_id -> collaborations.collaboration_id', COUNT(*)
FROM reviews AS r
LEFT JOIN collaborations AS co ON co.collaboration_id = r.collaboration_id
WHERE co.collaboration_id IS NULL;

-- ------------------------------------------------------------
-- 5. Uniqueness checks (all should return 0)
-- ------------------------------------------------------------
SELECT 'applications (campaign_id, creator_id)' AS uniqueness_rule, COUNT(*) AS duplicate_count
FROM (
    SELECT campaign_id, creator_id
    FROM applications
    GROUP BY campaign_id, creator_id
    HAVING COUNT(*) > 1
) AS duplicates
UNION ALL
SELECT 'collaborations.application_id', COUNT(*)
FROM (
    SELECT application_id
    FROM collaborations
    GROUP BY application_id
    HAVING COUNT(*) > 1
) AS duplicates
UNION ALL
SELECT 'contracts.collaboration_id', COUNT(*)
FROM (
    SELECT collaboration_id
    FROM contracts
    GROUP BY collaboration_id
    HAVING COUNT(*) > 1
) AS duplicates
UNION ALL
SELECT 'performance_metrics.collaboration_id', COUNT(*)
FROM (
    SELECT collaboration_id
    FROM performance_metrics
    GROUP BY collaboration_id
    HAVING COUNT(*) > 1
) AS duplicates
UNION ALL
SELECT 'reviews.collaboration_id', COUNT(*)
FROM (
    SELECT collaboration_id
    FROM reviews
    GROUP BY collaboration_id
    HAVING COUNT(*) > 1
) AS duplicates;

-- ------------------------------------------------------------
-- 6. Constraint sanity checks (all should return 0)
-- ------------------------------------------------------------
SELECT 'campaigns.budget <= 0' AS constraint_check, COUNT(*) AS violation_count
FROM campaigns
WHERE budget <= 0
UNION ALL
SELECT 'campaigns.end_date < start_date', COUNT(*)
FROM campaigns
WHERE end_date < start_date
UNION ALL
SELECT 'campaigns.min_followers < 0', COUNT(*)
FROM campaigns
WHERE min_followers < 0
UNION ALL
SELECT 'campaigns.creator_limit <= 0', COUNT(*)
FROM campaigns
WHERE creator_limit <= 0
UNION ALL
SELECT 'campaigns.max_creators <= 0', COUNT(*)
FROM campaigns
WHERE max_creators <= 0
UNION ALL
SELECT 'collaborations.agreed_amount < 0', COUNT(*)
FROM collaborations
WHERE agreed_amount < 0
UNION ALL
SELECT 'collaborations.end_date < start_date', COUNT(*)
FROM collaborations
WHERE end_date < start_date
UNION ALL
SELECT 'contracts.expiry_date < signed_date', COUNT(*)
FROM contracts
WHERE signed_date IS NOT NULL
  AND expiry_date IS NOT NULL
  AND expiry_date < signed_date
UNION ALL
SELECT 'creator_social_accounts.followers < 0', COUNT(*)
FROM creator_social_accounts
WHERE followers < 0
UNION ALL
SELECT 'creator_social_accounts.engagement_rate outside 0-100', COUNT(*)
FROM creator_social_accounts
WHERE engagement_rate < 0
   OR engagement_rate > 100
UNION ALL
SELECT 'payments.amount < 0', COUNT(*)
FROM payments
WHERE amount < 0
UNION ALL
SELECT 'performance_metrics negative counter', COUNT(*)
FROM performance_metrics
WHERE `views` < 0
   OR `likes` < 0
   OR `comments` < 0
   OR `shares` < 0
   OR `clicks` < 0
UNION ALL
SELECT 'reviews.rating outside 1-5', COUNT(*)
FROM reviews
WHERE rating < 1
   OR rating > 5
UNION ALL
SELECT 'campaign_requirements.min_engagement_rate outside 0-100', COUNT(*)
FROM campaign_requirements
WHERE min_engagement_rate < 0
   OR min_engagement_rate > 100;

-- ------------------------------------------------------------
-- 7. Relationship and business-rule checks
-- ------------------------------------------------------------
SELECT 'Accepted applications without collaboration' AS check_name, COUNT(*) AS violation_count
FROM applications AS a
LEFT JOIN collaborations AS co
    ON co.application_id = a.application_id
WHERE a.status = 'Accepted'
  AND co.collaboration_id IS NULL
UNION ALL
SELECT 'Collaborations whose application is not Accepted', COUNT(*)
FROM collaborations AS co
INNER JOIN applications AS a
    ON a.application_id = co.application_id
WHERE a.status <> 'Accepted'
UNION ALL
SELECT 'Campaigns with accepted creators above capacity', COUNT(*)
FROM (
    SELECT
        c.campaign_id
    FROM campaigns AS c
    INNER JOIN applications AS a
        ON a.campaign_id = c.campaign_id
       AND a.status = 'Accepted'
    INNER JOIN collaborations AS co
        ON co.application_id = a.application_id
    GROUP BY c.campaign_id, c.max_creators, c.creator_limit
    HAVING COUNT(co.collaboration_id) > LEAST(c.max_creators, c.creator_limit)
) AS over_capacity
UNION ALL
SELECT 'Campaigns whose paid total exceeds budget', COUNT(*)
FROM (
    SELECT
        c.campaign_id
    FROM campaigns AS c
    INNER JOIN applications AS a
        ON a.campaign_id = c.campaign_id
       AND a.status = 'Accepted'
    INNER JOIN collaborations AS co
        ON co.application_id = a.application_id
    INNER JOIN payments AS p
        ON p.collaboration_id = co.collaboration_id
       AND p.status = 'Paid'
    GROUP BY c.campaign_id, c.budget
    HAVING SUM(p.amount) > c.budget
) AS over_budget
UNION ALL
SELECT 'Collaborations whose payment total differs from agreed amount', COUNT(*)
FROM (
    SELECT
        co.collaboration_id
    FROM collaborations AS co
    LEFT JOIN payments AS p
        ON p.collaboration_id = co.collaboration_id
    GROUP BY co.collaboration_id, co.agreed_amount
    HAVING COALESCE(SUM(p.amount), 0) <> co.agreed_amount
) AS mismatched_payments
UNION ALL
SELECT 'Reviews attached to non-completed collaborations', COUNT(*)
FROM reviews AS r
INNER JOIN collaborations AS co
    ON co.collaboration_id = r.collaboration_id
WHERE co.status <> 'Completed';

-- ------------------------------------------------------------
-- 8. Trigger verification
-- ------------------------------------------------------------
SELECT 'Completed collaborations' AS check_name, COUNT(*) AS actual_count, 12 AS expected_count
FROM collaborations
WHERE status = 'Completed'
UNION ALL
SELECT 'Active collaborations', COUNT(*), 4
FROM collaborations
WHERE status = 'Active'
UNION ALL
SELECT 'Completed collaborations without a Paid payment', COUNT(*), 0
FROM collaborations AS co
WHERE co.status = 'Completed'
  AND NOT EXISTS (
      SELECT 1
      FROM payments AS p
      WHERE p.collaboration_id = co.collaboration_id
        AND p.status = 'Paid'
  )
UNION ALL
SELECT 'Active collaborations with a Paid payment', COUNT(*), 0
FROM collaborations AS co
WHERE co.status = 'Active'
  AND EXISTS (
      SELECT 1
      FROM payments AS p
      WHERE p.collaboration_id = co.collaboration_id
        AND p.status = 'Paid'
  );

SELECT
    co.collaboration_id,
    co.status AS collaboration_status,
    MAX(CASE WHEN p.status = 'Paid' THEN 1 ELSE 0 END) AS has_paid_payment,
    SUM(p.amount) AS total_payment_amount,
    co.agreed_amount
FROM collaborations AS co
LEFT JOIN payments AS p
    ON p.collaboration_id = co.collaboration_id
GROUP BY co.collaboration_id, co.status, co.agreed_amount
ORDER BY co.collaboration_id;

SELECT
    TRIGGER_NAME,
    EVENT_MANIPULATION,
    EVENT_OBJECT_TABLE,
    ACTION_TIMING
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
ORDER BY TRIGGER_NAME;

-- ------------------------------------------------------------
-- 9. View verification
-- ------------------------------------------------------------
SELECT 'campaign_creator_summary rows' AS check_name, COUNT(*) AS actual_count, 34 AS expected_count
FROM campaign_creator_summary
UNION ALL
SELECT 'campaign_creator_summary rows with collaboration', COUNT(*), 16
FROM campaign_creator_summary
WHERE collaboration_id IS NOT NULL
UNION ALL
SELECT 'campaign_creator_summary rows without collaboration', COUNT(*), 18
FROM campaign_creator_summary
WHERE collaboration_id IS NULL;

SELECT *
FROM campaign_creator_summary
WHERE campaign_id IN (1, 2)
ORDER BY campaign_id, application_id;

-- ------------------------------------------------------------
-- 10. Stored procedure verification
-- ------------------------------------------------------------
SELECT COUNT(*) AS expected_campaign_1_applicants
FROM applications
WHERE campaign_id = 1;

CALL get_campaign_creators(1);
CALL get_campaign_creators(3);

-- ------------------------------------------------------------
-- 11. Seed coverage summary
-- ------------------------------------------------------------
SELECT
    (SELECT COUNT(*) FROM brands) AS brands,
    (SELECT COUNT(*) FROM campaigns) AS campaigns,
    (SELECT COUNT(*) FROM creators) AS creators,
    (SELECT COUNT(*) FROM applications) AS applications,
    (SELECT COUNT(*) FROM collaborations) AS collaborations,
    (SELECT COUNT(*) FROM deliverables) AS deliverables,
    (SELECT COUNT(*) FROM content_submissions) AS submissions,
    (SELECT COUNT(*) FROM payments) AS payments,
    (SELECT COUNT(*) FROM reviews) AS reviews;

SELECT
    c.status AS campaign_status,
    COUNT(*) AS campaign_count,
    SUM(c.budget) AS total_budget
FROM campaigns AS c
GROUP BY c.status
ORDER BY c.status;

-- ============================================================
-- End of verification.
-- ============================================================
