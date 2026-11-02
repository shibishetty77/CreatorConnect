-- ============================================================
-- CreatorConnect - Phase 2 basic demonstration queries
-- Database: creatorconnect
--
-- All statements in this file are read-only.
-- Run after database/02_seed_data.sql has been approved and executed.
-- ============================================================

USE creatorconnect;

-- ------------------------------------------------------------
-- 1. Campaign overview with brand and category (INNER + LEFT JOIN)
-- ------------------------------------------------------------
SELECT
    c.campaign_id,
    c.campaign_name,
    b.brand_name,
    cc.category_name,
    c.budget,
    c.status,
    c.start_date,
    c.end_date
FROM campaigns AS c
INNER JOIN brands AS b
    ON b.brand_id = c.brand_id
LEFT JOIN campaign_categories AS cc
    ON cc.category_id = c.category_id
ORDER BY c.start_date DESC, c.campaign_id;

-- ------------------------------------------------------------
-- 2. Creator follower totals and average engagement (GROUP BY)
-- ------------------------------------------------------------
SELECT
    cr.creator_id,
    CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
    cr.city,
    COUNT(csa.account_id) AS account_count,
    COALESCE(SUM(csa.followers), 0) AS total_followers,
    ROUND(COALESCE(AVG(csa.engagement_rate), 0), 2) AS avg_engagement_rate
FROM creators AS cr
LEFT JOIN creator_social_accounts AS csa
    ON csa.creator_id = cr.creator_id
GROUP BY cr.creator_id, cr.first_name, cr.last_name, cr.city
ORDER BY total_followers DESC, cr.creator_id;

-- ------------------------------------------------------------
-- 3. Campaign application funnel (conditional aggregation)
-- ------------------------------------------------------------
SELECT
    c.campaign_id,
    c.campaign_name,
    COUNT(a.application_id) AS total_applications,
    COALESCE(SUM(a.status = 'Pending'), 0) AS pending_count,
    COALESCE(SUM(a.status = 'Accepted'), 0) AS accepted_count,
    COALESCE(SUM(a.status = 'Rejected'), 0) AS rejected_count
FROM campaigns AS c
LEFT JOIN applications AS a
    ON a.campaign_id = c.campaign_id
GROUP BY c.campaign_id, c.campaign_name
ORDER BY total_applications DESC, c.campaign_id;

-- ------------------------------------------------------------
-- 4. Campaigns with at least three applications (GROUP BY + HAVING)
-- ------------------------------------------------------------
SELECT
    c.campaign_id,
    c.campaign_name,
    COUNT(a.application_id) AS application_count
FROM campaigns AS c
INNER JOIN applications AS a
    ON a.campaign_id = c.campaign_id
GROUP BY c.campaign_id, c.campaign_name
HAVING COUNT(a.application_id) >= 3
ORDER BY application_count DESC, c.campaign_id;

-- ------------------------------------------------------------
-- 5. Brand budget versus committed collaboration value
-- ------------------------------------------------------------
SELECT
    b.brand_id,
    b.brand_name,
    COUNT(DISTINCT c.campaign_id) AS campaign_count,
    COALESCE(SUM(c.budget), 0) AS total_campaign_budget,
    COALESCE(SUM(committed.committed_amount), 0) AS total_committed_amount
FROM brands AS b
LEFT JOIN campaigns AS c
    ON c.brand_id = b.brand_id
LEFT JOIN (
    SELECT
        c2.campaign_id,
        SUM(co.agreed_amount) AS committed_amount
    FROM campaigns AS c2
    INNER JOIN applications AS a
        ON a.campaign_id = c2.campaign_id
       AND a.status = 'Accepted'
    INNER JOIN collaborations AS co
        ON co.application_id = a.application_id
    GROUP BY c2.campaign_id
) AS committed
    ON committed.campaign_id = c.campaign_id
GROUP BY b.brand_id, b.brand_name
ORDER BY total_campaign_budget DESC, b.brand_id;

-- ------------------------------------------------------------
-- 6. Payment status totals (aggregate functions)
-- ------------------------------------------------------------
SELECT
    p.status,
    COUNT(*) AS payment_count,
    SUM(p.amount) AS total_amount,
    ROUND(AVG(p.amount), 2) AS average_payment,
    MIN(p.payment_date) AS first_payment_date,
    MAX(p.payment_date) AS last_payment_date
FROM payments AS p
GROUP BY p.status
ORDER BY total_amount DESC;

-- ------------------------------------------------------------
-- 7. Campaign budget utilization
-- ------------------------------------------------------------
SELECT
    c.campaign_id,
    c.campaign_name,
    c.budget,
    COALESCE(SUM(co.agreed_amount), 0) AS committed_amount,
    c.budget - COALESCE(SUM(co.agreed_amount), 0) AS remaining_amount,
    ROUND(100 * COALESCE(SUM(co.agreed_amount), 0) / c.budget, 1) AS utilization_pct
FROM campaigns AS c
LEFT JOIN applications AS a
    ON a.campaign_id = c.campaign_id
   AND a.status = 'Accepted'
LEFT JOIN collaborations AS co
    ON co.application_id = a.application_id
GROUP BY c.campaign_id, c.campaign_name, c.budget
ORDER BY utilization_pct DESC, c.campaign_id;

-- ------------------------------------------------------------
-- 8. Creator earnings from paid collaborations
-- ------------------------------------------------------------
SELECT
    cr.creator_id,
    CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
    COUNT(DISTINCT co.collaboration_id) AS collaboration_count,
    COALESCE(SUM(CASE WHEN p.status = 'Paid' THEN p.amount ELSE 0 END), 0) AS paid_earnings,
    COALESCE(SUM(CASE WHEN p.status = 'Pending' THEN p.amount ELSE 0 END), 0) AS pending_earnings
FROM creators AS cr
INNER JOIN applications AS a
    ON a.creator_id = cr.creator_id
   AND a.status = 'Accepted'
INNER JOIN collaborations AS co
    ON co.application_id = a.application_id
LEFT JOIN payments AS p
    ON p.collaboration_id = co.collaboration_id
GROUP BY cr.creator_id, cr.first_name, cr.last_name
ORDER BY paid_earnings DESC, cr.creator_id;

-- ------------------------------------------------------------
-- 9. Campaigns with above-average budget (uncorrelated subquery)
-- ------------------------------------------------------------
SELECT
    c.campaign_id,
    c.campaign_name,
    c.budget
FROM campaigns AS c
WHERE c.budget > (
    SELECT AVG(all_campaigns.budget)
    FROM campaigns AS all_campaigns
)
ORDER BY c.budget DESC, c.campaign_id;

-- ------------------------------------------------------------
-- 10. Creators with above-average total followers (correlated subquery)
-- ------------------------------------------------------------
SELECT
    cr.creator_id,
    CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
    (
        SELECT COALESCE(SUM(csa.followers), 0)
        FROM creator_social_accounts AS csa
        WHERE csa.creator_id = cr.creator_id
    ) AS total_followers
FROM creators AS cr
WHERE (
    SELECT COALESCE(SUM(csa.followers), 0)
    FROM creator_social_accounts AS csa
    WHERE csa.creator_id = cr.creator_id
) > (
    SELECT AVG(creator_totals.total_followers)
    FROM (
        SELECT creator_id, SUM(followers) AS total_followers
        FROM creator_social_accounts
        GROUP BY creator_id
    ) AS creator_totals
)
ORDER BY total_followers DESC, cr.creator_id;

-- ------------------------------------------------------------
-- 11. Full relationship chain: campaign, brand, creator, collaboration, payment
-- ------------------------------------------------------------
SELECT
    c.campaign_name,
    b.brand_name,
    CONCAT(cr.first_name, ' ', cr.last_name) AS creator_name,
    a.status AS application_status,
    co.status AS collaboration_status,
    co.agreed_amount,
    p.status AS payment_status,
    p.amount,
    p.payment_date
FROM campaigns AS c
INNER JOIN brands AS b
    ON b.brand_id = c.brand_id
INNER JOIN applications AS a
    ON a.campaign_id = c.campaign_id
INNER JOIN creators AS cr
    ON cr.creator_id = a.creator_id
LEFT JOIN collaborations AS co
    ON co.application_id = a.application_id
LEFT JOIN payments AS p
    ON p.collaboration_id = co.collaboration_id
ORDER BY c.campaign_id, cr.creator_id, p.payment_id;

-- ------------------------------------------------------------
-- 12. Content approval rate by content type
-- ------------------------------------------------------------
SELECT
    d.content_type,
    COUNT(cs.submission_id) AS submission_count,
    COALESCE(SUM(cs.approval_status = 'Approved'), 0) AS approved_count,
    COALESCE(SUM(cs.approval_status = 'Rejected'), 0) AS rejected_count,
    COALESCE(SUM(cs.approval_status = 'Pending'), 0) AS pending_count,
    ROUND(100 * COALESCE(SUM(cs.approval_status = 'Approved'), 0) / COUNT(cs.submission_id), 1) AS approval_rate_pct
FROM deliverables AS d
INNER JOIN content_submissions AS cs
    ON cs.deliverable_id = d.deliverable_id
GROUP BY d.content_type
ORDER BY approval_rate_pct DESC, d.content_type;

-- ------------------------------------------------------------
-- 13. Campaign requirements grouped by platform
-- ------------------------------------------------------------
SELECT
    req.platform,
    COUNT(*) AS requirement_count,
    ROUND(AVG(req.min_engagement_rate), 2) AS avg_min_engagement_rate,
    MIN(req.min_engagement_rate) AS lowest_min_engagement_rate,
    MAX(req.min_engagement_rate) AS highest_min_engagement_rate
FROM campaign_requirements AS req
GROUP BY req.platform
ORDER BY requirement_count DESC, req.platform;

-- ------------------------------------------------------------
-- 14. Review distribution with creator names
-- ------------------------------------------------------------
SELECT
    r.rating,
    COUNT(*) AS review_count,
    GROUP_CONCAT(
        CONCAT(cr.first_name, ' ', cr.last_name)
        ORDER BY cr.creator_id
        SEPARATOR ', '
    ) AS reviewed_creators
FROM reviews AS r
INNER JOIN collaborations AS co
    ON co.collaboration_id = r.collaboration_id
INNER JOIN applications AS a
    ON a.application_id = co.application_id
INNER JOIN creators AS cr
    ON cr.creator_id = a.creator_id
GROUP BY r.rating
ORDER BY r.rating DESC;

-- ------------------------------------------------------------
-- 15. Campaign engagement totals
-- ------------------------------------------------------------
SELECT
    c.campaign_id,
    c.campaign_name,
    SUM(pm.views) AS total_views,
    SUM(pm.likes) AS total_likes,
    SUM(pm.comments) AS total_comments,
    SUM(pm.shares) AS total_shares,
    SUM(pm.clicks) AS total_clicks,
    ROUND(
        100 * SUM(pm.likes + pm.comments + pm.shares)
        / NULLIF(SUM(pm.views), 0),
        2
    ) AS engagement_rate_pct
FROM campaigns AS c
INNER JOIN applications AS a
    ON a.campaign_id = c.campaign_id
   AND a.status = 'Accepted'
INNER JOIN collaborations AS co
    ON co.application_id = a.application_id
INNER JOIN performance_metrics AS pm
    ON pm.collaboration_id = co.collaboration_id
GROUP BY c.campaign_id, c.campaign_name
ORDER BY total_views DESC, c.campaign_id;

-- ------------------------------------------------------------
-- 16. Campaign category budget totals
-- ------------------------------------------------------------
SELECT
    cc.category_id,
    cc.category_name,
    COUNT(DISTINCT c.campaign_id) AS campaign_count,
    COALESCE(SUM(c.budget), 0) AS total_budget
FROM campaign_categories AS cc
LEFT JOIN campaigns AS c
    ON c.category_id = cc.category_id
GROUP BY cc.category_id, cc.category_name
ORDER BY total_budget DESC, cc.category_id;

-- ------------------------------------------------------------
-- 17. Brands with at least two campaigns and more than 200000 total budget
-- ------------------------------------------------------------
SELECT
    b.brand_id,
    b.brand_name,
    COUNT(c.campaign_id) AS campaign_count,
    SUM(c.budget) AS total_budget
FROM brands AS b
INNER JOIN campaigns AS c
    ON c.brand_id = b.brand_id
GROUP BY b.brand_id, b.brand_name
HAVING COUNT(c.campaign_id) >= 2
   AND SUM(c.budget) > 200000
ORDER BY total_budget DESC, b.brand_id;

-- ------------------------------------------------------------
-- 18. Existing view: campaign_creator_summary
-- ------------------------------------------------------------
SELECT
    campaign_id,
    campaign_name,
    brand_id,
    creator_id,
    first_name,
    last_name,
    application_status,
    collaboration_id,
    agreed_amount,
    collaboration_status
FROM campaign_creator_summary
WHERE campaign_id IN (1, 2)
ORDER BY campaign_id, application_id;

-- ============================================================
-- End of basic queries.
-- Next: database/04_advanced_queries.sql
-- ============================================================
