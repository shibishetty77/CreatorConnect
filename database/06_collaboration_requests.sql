-- CreatorConnect - direct collaboration requests
--
-- Additive migration only. It adds nullable columns, indexes, backfills
-- existing collaboration titles from their campaigns, and extends the
-- collaboration status enum with Pending and Rejected. No rows are deleted
-- and no existing values are overwritten.
--
-- The preferred runner is:
--   node --env-file-if-exists=.env --env-file-if-exists=.env.local --import tsx scripts/migrate-collaboration-requests.ts
--
-- The TypeScript runner checks information_schema before each change, so it is
-- safe to run repeatedly. This SQL file documents the equivalent one-time DDL.

ALTER TABLE collaborations
    MODIFY COLUMN status ENUM('Pending', 'Active', 'Completed', 'Rejected')
        NULL DEFAULT 'Active',
    ADD COLUMN title VARCHAR(150) NULL AFTER application_id,
    ADD COLUMN description TEXT NULL AFTER title,
    ADD COLUMN deliverable_description TEXT NULL AFTER description,
    ADD COLUMN additional_requirements TEXT NULL AFTER deliverable_description,
    ADD COLUMN requested_by ENUM('Brand', 'Creator') NULL AFTER additional_requirements,
    ADD COLUMN decided_at TIMESTAMP NULL DEFAULT NULL AFTER status,
    ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER decided_at,
    ADD INDEX idx_collaboration_request_status (requested_by, status);

UPDATE collaborations co
INNER JOIN applications a ON a.application_id = co.application_id
INNER JOIN campaigns ca ON ca.campaign_id = a.campaign_id
SET co.title = ca.campaign_name
WHERE co.title IS NULL;
