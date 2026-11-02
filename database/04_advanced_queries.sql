-- ============================================================
-- CreatorConnect - Phase 2 advanced SQL demonstrations
-- Database: creatorconnect
--
-- All data-changing statements are avoided. The transaction section
-- demonstrates transaction control with read-only statements only.
-- Run after database/02_seed_data.sql has been approved and executed.
-- ============================================================

USE creatorconnect;

-- ------------------------------------------------------------
-- 1. CTE: campaign application funnel and acceptance rate
-- ------------------------------------------------------------
WITH campaign_funnel AS (
    SELECT
        c.campaign_id,
        c.campaign_name,
        b.brand_name,
        cc.category_name,
        COUNT(a.application_id) AS total_applications,
        COALESCE(SUM(a.status = 'Accepted'), 0) AS accepted_applications,
        COALESCE(SUM(a.status = 'Rejected'), 0) AS rejected_applications,
        COALESCE(SUM(a.status = 'Pending'), 0) AS pending_applications
    FROM campaigns AS c
    INNER JOIN brands AS b
        ON b.brand_id = c.brand_id
    LEFT JOIN campaign_categories AS cc
        ON cc.category_id = c.category_id
    LEFT JOIN applications AS a
        ON a.campaign_id = c.campaign_id
    GROUP BY
        c.campaign_id,
        c.campaign_name,
        b.brand_name,
        cc.category_name
)
SELECT
    campaign_id,
    campaign_name,
    brand_name,
    category_name,
    total_applications,
    accepted_applications,
    rejected_applications,
    pending_applications,
    ROUND(100 * accepted_applications / NULLIF(total_applications, 0), 1) AS acceptance_rate_pct
FROM campaign_funnel
ORDER BY acceptance_rate_pct DESC, campaign_id;

-- ------------------------------------------------------------
-- 2. CTE + DENSE_RANK: creator earnings leaderboard
-- ------------------------------------------------------------
WITH creator_earnings AS (
    SELECT
        cr.creator_id,
        CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
        COUNT(DISTINCT co.collaboration_id) AS collaboration_count,
        COALESCE(SUM(CASE WHEN p.status = 'Paid' THEN p.amount ELSE 0 END), 0) AS paid_earnings
    FROM creators AS cr
    INNER JOIN applications AS a
        ON a.creator_id = cr.creator_id
       AND a.status = 'Accepted'
    INNER JOIN collaborations AS co
        ON co.application_id = a.application_id
    LEFT JOIN payments AS p
        ON p.collaboration_id = co.collaboration_id
    GROUP BY cr.creator_id, cr.first_name, cr.last_name
)
SELECT
    creator_id,
    creator_name,
    collaboration_count,
    paid_earnings,
    DENSE_RANK() OVER (ORDER BY paid_earnings DESC) AS earnings_rank
FROM creator_earnings
ORDER BY earnings_rank, creator_id;

-- ------------------------------------------------------------
-- 3. ROW_NUMBER: top two creators by agreed amount per campaign
-- ------------------------------------------------------------
WITH ranked_campaign_creators AS (
    SELECT
        c.campaign_id,
        c.campaign_name,
        cr.creator_id,
        CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
        co.agreed_amount,
        ROW_NUMBER() OVER (
            PARTITION BY c.campaign_id
            ORDER BY co.agreed_amount DESC, cr.creator_id
        ) AS creator_row_number
    FROM campaigns AS c
    INNER JOIN applications AS a
        ON a.campaign_id = c.campaign_id
       AND a.status = 'Accepted'
    INNER JOIN creators AS cr
        ON cr.creator_id = a.creator_id
    INNER JOIN collaborations AS co
        ON co.application_id = a.application_id
)
SELECT
    campaign_id,
    campaign_name,
    creator_id,
    creator_name,
    agreed_amount,
    creator_row_number
FROM ranked_campaign_creators
WHERE creator_row_number <= 2
ORDER BY campaign_id, creator_row_number;

-- ------------------------------------------------------------
-- 4. Window function: running campaign budget per brand
-- ------------------------------------------------------------
SELECT
    c.campaign_id,
    b.brand_name,
    c.start_date,
    c.budget,
    SUM(c.budget) OVER (
        PARTITION BY c.brand_id
        ORDER BY c.start_date, c.campaign_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_brand_budget,
    ROUND(AVG(c.budget) OVER (PARTITION BY c.brand_id), 2) AS brand_average_budget
FROM campaigns AS c
INNER JOIN brands AS b
    ON b.brand_id = c.brand_id
ORDER BY b.brand_name, c.start_date, c.campaign_id;

-- ------------------------------------------------------------
-- 5. LAG and LEAD: campaign budget movement over time
-- ------------------------------------------------------------
SELECT
    campaign_id,
    campaign_name,
    start_date,
    budget,
    LAG(budget) OVER (ORDER BY start_date, campaign_id) AS previous_budget,
    LEAD(budget) OVER (ORDER BY start_date, campaign_id) AS next_budget,
    budget - LAG(budget) OVER (ORDER BY start_date, campaign_id) AS budget_change
FROM campaigns
ORDER BY start_date, campaign_id;

-- ------------------------------------------------------------
-- 6. NTILE: creators divided into follower quartiles
-- ------------------------------------------------------------
WITH creator_followers AS (
    SELECT
        cr.creator_id,
        CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
        COALESCE(SUM(csa.followers), 0) AS total_followers
    FROM creators AS cr
    LEFT JOIN creator_social_accounts AS csa
        ON csa.creator_id = cr.creator_id
    GROUP BY cr.creator_id, cr.first_name, cr.last_name
)
SELECT
    creator_id,
    creator_name,
    total_followers,
    NTILE(4) OVER (ORDER BY total_followers DESC) AS follower_quartile
FROM creator_followers
ORDER BY total_followers DESC, creator_id;

-- ------------------------------------------------------------
-- 7. Recursive CTE: campaign activity by calendar month
-- ------------------------------------------------------------
WITH RECURSIVE month_series AS (
    SELECT DATE_FORMAT(MIN(start_date), '%Y-%m-01') AS month_start
    FROM campaigns
    UNION ALL
    SELECT DATE_ADD(month_start, INTERVAL 1 MONTH)
    FROM month_series
    WHERE month_start < (
        SELECT DATE_FORMAT(MAX(end_date), '%Y-%m-01')
        FROM campaigns
    )
)
SELECT
    DATE_FORMAT(ms.month_start, '%Y-%m') AS month,
    COUNT(DISTINCT c.campaign_id) AS campaigns_running,
    GROUP_CONCAT(
        c.campaign_name
        ORDER BY c.campaign_id
        SEPARATOR '; '
    ) AS campaign_names
FROM month_series AS ms
LEFT JOIN campaigns AS c
    ON c.start_date <= LAST_DAY(ms.month_start)
   AND c.end_date >= ms.month_start
GROUP BY ms.month_start
ORDER BY ms.month_start;

-- ------------------------------------------------------------
-- 8. Window aggregate: budget variance from overall average
-- ------------------------------------------------------------
SELECT
    campaign_id,
    campaign_name,
    budget,
    ROUND(AVG(budget) OVER (), 2) AS overall_average_budget,
    budget - ROUND(AVG(budget) OVER (), 2) AS variance_from_average,
    ROUND(
        100 * (budget - AVG(budget) OVER ()) / AVG(budget) OVER (),
        1
    ) AS variance_pct
FROM campaigns
ORDER BY variance_from_average DESC, campaign_id;

-- ------------------------------------------------------------
-- 9. RANK: top paid campaigns per brand
-- ------------------------------------------------------------
WITH campaign_paid_amounts AS (
    SELECT
        c.campaign_id,
        c.campaign_name,
        c.brand_id,
        b.brand_name,
        COALESCE(SUM(CASE WHEN p.status = 'Paid' THEN p.amount ELSE 0 END), 0) AS paid_amount
    FROM campaigns AS c
    INNER JOIN brands AS b
        ON b.brand_id = c.brand_id
    LEFT JOIN applications AS a
        ON a.campaign_id = c.campaign_id
       AND a.status = 'Accepted'
    LEFT JOIN collaborations AS co
        ON co.application_id = a.application_id
    LEFT JOIN payments AS p
        ON p.collaboration_id = co.collaboration_id
    GROUP BY
        c.campaign_id,
        c.campaign_name,
        c.brand_id,
        b.brand_name
)
SELECT
    brand_id,
    brand_name,
    campaign_id,
    campaign_name,
    paid_amount,
    brand_rank
FROM (
    SELECT
        brand_id,
        brand_name,
        campaign_id,
        campaign_name,
        paid_amount,
        RANK() OVER (
            PARTITION BY brand_id
            ORDER BY paid_amount DESC, campaign_id
        ) AS brand_rank
    FROM campaign_paid_amounts
) AS ranked_campaigns
WHERE brand_rank <= 2
ORDER BY brand_id, brand_rank;

-- ------------------------------------------------------------
-- 10. ROLLUP and GROUPING(): brand/category budget subtotals
-- ------------------------------------------------------------
SELECT
    b.brand_name,
    cc.category_name,
    SUM(c.budget) AS total_budget,
    GROUPING(b.brand_name) AS brand_rollup,
    GROUPING(cc.category_name) AS category_rollup
FROM campaigns AS c
INNER JOIN brands AS b
    ON b.brand_id = c.brand_id
INNER JOIN campaign_categories AS cc
    ON cc.category_id = c.category_id
GROUP BY b.brand_name, cc.category_name WITH ROLLUP
ORDER BY
    GROUPING(b.brand_name),
    b.brand_name,
    GROUPING(cc.category_name),
    cc.category_name;

-- ------------------------------------------------------------
-- 11. PERCENT_RANK and CUME_DIST: creator earnings distribution
-- ------------------------------------------------------------
WITH creator_earnings AS (
    SELECT
        cr.creator_id,
        CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
        COALESCE(SUM(CASE WHEN p.status = 'Paid' THEN p.amount ELSE 0 END), 0) AS paid_earnings
    FROM creators AS cr
    INNER JOIN applications AS a
        ON a.creator_id = cr.creator_id
       AND a.status = 'Accepted'
    INNER JOIN collaborations AS co
        ON co.application_id = a.application_id
    LEFT JOIN payments AS p
        ON p.collaboration_id = co.collaboration_id
    GROUP BY cr.creator_id, cr.first_name, cr.last_name
)
SELECT
    creator_id,
    creator_name,
    paid_earnings,
    ROUND(PERCENT_RANK() OVER (ORDER BY paid_earnings), 3) AS pct_rank,
    ROUND(CUME_DIST() OVER (ORDER BY paid_earnings), 3) AS cumulative_distribution
FROM creator_earnings
ORDER BY paid_earnings DESC, creator_id;

-- ------------------------------------------------------------
-- 12. EXISTS and NOT EXISTS: campaigns with applicants but no paid creators
-- ------------------------------------------------------------
SELECT
    c.campaign_id,
    c.campaign_name,
    c.status
FROM campaigns AS c
WHERE EXISTS (
    SELECT 1
    FROM applications AS a
    WHERE a.campaign_id = c.campaign_id
)
AND NOT EXISTS (
    SELECT 1
    FROM applications AS a
    INNER JOIN collaborations AS co
        ON co.application_id = a.application_id
    INNER JOIN payments AS p
        ON p.collaboration_id = co.collaboration_id
    WHERE a.campaign_id = c.campaign_id
      AND p.status = 'Paid'
)
ORDER BY c.campaign_id;

-- ------------------------------------------------------------
-- 13. JSON_ARRAYAGG: creators grouped per campaign
-- ------------------------------------------------------------
SELECT
    c.campaign_id,
    c.campaign_name,
    JSON_ARRAYAGG(
        JSON_OBJECT(
            'creator_id', cr.creator_id,
            'creator_name', CONCAT(cr.first_name, ' ', cr.last_name),
            'application_status', a.status
        )
    ) AS applicants
FROM campaigns AS c
INNER JOIN applications AS a
    ON a.campaign_id = c.campaign_id
INNER JOIN creators AS cr
    ON cr.creator_id = a.creator_id
GROUP BY c.campaign_id, c.campaign_name
ORDER BY c.campaign_id;

-- ------------------------------------------------------------
-- 14. Window function over the existing view
-- ------------------------------------------------------------
SELECT
    campaign_id,
    campaign_name,
    creator_id,
    first_name,
    last_name,
    application_status,
    collaboration_status,
    agreed_amount,
    RANK() OVER (
        PARTITION BY campaign_id
        ORDER BY agreed_amount DESC, creator_id
    ) AS agreed_amount_rank
FROM campaign_creator_summary
WHERE collaboration_id IS NOT NULL
ORDER BY campaign_id, agreed_amount_rank;

-- ------------------------------------------------------------
-- 15. Stored procedure demonstration
-- ------------------------------------------------------------
CALL get_campaign_creators(1);

-- ------------------------------------------------------------
-- 16. Transaction control demonstration (read-only)
--
-- No INSERT, UPDATE, or DELETE is executed. The savepoint exists only to
-- demonstrate transaction syntax. A future write should follow the same
-- START TRANSACTION / COMMIT or ROLLBACK pattern.
-- ------------------------------------------------------------
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

START TRANSACTION;

SELECT COUNT(*) AS campaigns_in_transaction
FROM campaigns;

SAVEPOINT read_only_demo_checkpoint;

SELECT COUNT(*) AS open_campaigns_in_transaction
FROM campaigns
WHERE status = 'Open';

ROLLBACK TO SAVEPOINT read_only_demo_checkpoint;

COMMIT;

-- Write transaction template for future application code:
-- START TRANSACTION;
-- INSERT INTO applications (...) VALUES (...);
-- COMMIT;
-- or
-- ROLLBACK;

-- ============================================================
-- End of advanced queries.
-- Next: database/05_verification.sql
-- ============================================================
