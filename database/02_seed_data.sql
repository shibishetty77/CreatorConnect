-- ============================================================
-- CreatorConnect - Phase 2 seed data
-- Database: creatorconnect (MySQL 8.0.46)
--
-- DO NOT EXECUTE THIS FILE UNTIL THE PROJECT OWNER APPROVES.
--
-- Execution order after approval:
--   1. database/02_seed_data.sql
--   2. database/03_basic_queries.sql
--   3. database/04_advanced_queries.sql
--   4. database/05_verification.sql
--
-- Safety:
--   * No DROP, TRUNCATE, DELETE, ALTER, or schema change statements.
--   * All inserts run inside one transaction.
--   * Every row uses an explicit primary key.
--   * Re-running is idempotent: duplicate primary/unique keys become no-op
--     updates (`pk = pk`), so existing rows are never deleted or changed.
--   * Parent tables are inserted before child tables.
--
-- Trigger note:
--   `complete_collaboration_after_payment_insert` completes a collaboration
--   when a payment is inserted with status 'Paid'. Collaborations 1-6 and
--   11-16 are intentionally inserted as 'Active' first, then completed by
--   their paid payment rows. Collaborations 7-10 keep only Pending payments
--   and stay Active.
-- ============================================================

SET NAMES utf8mb4;

START TRANSACTION;

-- ------------------------------------------------------------
-- 1. users (1 admin, 8 creators, 5 brands)
-- ------------------------------------------------------------
INSERT INTO `users` (`user_id`, `username`, `email`, `password_hash`, `role`, `created_at`) VALUES
  (1, 'admin_creatorconnect', 'admin@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Admin', '2026-01-05 09:00:00'),
  (2, 'ananya.rao', 'ananya.rao@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Creator', '2026-01-06 10:00:00'),
  (3, 'rohan.mehta', 'rohan.mehta@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Creator', '2026-01-06 10:05:00'),
  (4, 'priya.nair', 'priya.nair@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Creator', '2026-01-06 10:10:00'),
  (5, 'arjun.singh', 'arjun.singh@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Creator', '2026-01-06 10:15:00'),
  (6, 'meera.iyer', 'meera.iyer@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Creator', '2026-01-06 10:20:00'),
  (7, 'kabir.khan', 'kabir.khan@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Creator', '2026-01-06 10:25:00'),
  (8, 'sneha.patel', 'sneha.patel@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Creator', '2026-01-06 10:30:00'),
  (9, 'aditya.kulkarni', 'aditya.kulkarni@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Creator', '2026-01-06 10:35:00'),
  (10, 'brand.novathread', 'brand.novathread@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Brand', '2026-01-07 09:00:00'),
  (11, 'brand.pixelforge', 'brand.pixelforge@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Brand', '2026-01-07 09:05:00'),
  (12, 'brand.wanderly', 'brand.wanderly@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Brand', '2026-01-07 09:10:00'),
  (13, 'brand.fitcore', 'brand.fitcore@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Brand', '2026-01-07 09:15:00'),
  (14, 'brand.glowleaf', 'brand.glowleaf@creatorconnect.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.G1Kp3O', 'Brand', '2026-01-07 09:20:00')
ON DUPLICATE KEY UPDATE `user_id` = `user_id`;

-- ------------------------------------------------------------
-- 2. creators
-- ------------------------------------------------------------
INSERT INTO `creators` (`creator_id`, `user_id`, `first_name`, `last_name`, `date_of_birth`, `phone`, `bio`, `address`, `city`, `state`, `profile_picture`, `profile_picture_url`) VALUES
  (1, 2, 'Ananya', 'Rao', '1995-04-12', '9876500001', 'Lifestyle and fashion creator focused on everyday style, sustainable brands, and city stories.', '14 Indiranagar 2nd Stage', 'Bengaluru', 'Karnataka', '/images/creators/ananya-rao.jpg', 'https://cdn.creatorconnect.local/creators/ananya-rao.jpg'),
  (2, 3, 'Rohan', 'Mehta', '1993-11-03', '9876500002', 'Technology reviewer covering smartphones, productivity tools, and consumer gadgets.', '22 Bandra West', 'Mumbai', 'Maharashtra', '/images/creators/rohan-mehta.jpg', 'https://cdn.creatorconnect.local/creators/rohan-mehta.jpg'),
  (3, 4, 'Priya', 'Nair', '1996-07-21', '9876500003', 'Travel storyteller documenting coastal escapes, local food, and responsible tourism.', '7 Marine Drive', 'Kochi', 'Kerala', '/images/creators/priya-nair.jpg', 'https://cdn.creatorconnect.local/creators/priya-nair.jpg'),
  (4, 5, 'Arjun', 'Singh', '1994-02-17', '9876500004', 'Fitness coach sharing strength training, home workouts, and nutrition habits.', '31 Saket Colony', 'New Delhi', 'Delhi', '/images/creators/arjun-singh.jpg', 'https://cdn.creatorconnect.local/creators/arjun-singh.jpg'),
  (5, 6, 'Meera', 'Iyer', '1997-09-09', '9876500005', 'Beauty creator reviewing skincare routines, clean beauty products, and ingredient labels.', '18 Adyar Main Road', 'Chennai', 'Tamil Nadu', '/images/creators/meera-iyer.jpg', 'https://cdn.creatorconnect.local/creators/meera-iyer.jpg'),
  (6, 7, 'Kabir', 'Khan', '1992-12-30', '9876500006', 'Software engineer and tech educator creating developer tutorials and career content.', '9 Jubilee Hills', 'Hyderabad', 'Telangana', '/images/creators/kabir-khan.jpg', 'https://cdn.creatorconnect.local/creators/kabir-khan.jpg'),
  (7, 8, 'Sneha', 'Patel', '1998-05-14', '9876500007', 'Food and lifestyle creator exploring regional recipes, cafes, and home cooking.', '42 Satellite Road', 'Ahmedabad', 'Gujarat', '/images/creators/sneha-patel.jpg', 'https://cdn.creatorconnect.local/creators/sneha-patel.jpg'),
  (8, 9, 'Aditya', 'Kulkarni', '1991-08-25', '9876500008', 'Personal finance educator simplifying investing, budgeting, and financial planning.', '11 Kothrud', 'Pune', 'Maharashtra', '/images/creators/aditya-kulkarni.jpg', 'https://cdn.creatorconnect.local/creators/aditya-kulkarni.jpg')
ON DUPLICATE KEY UPDATE `creator_id` = `creator_id`;

-- ------------------------------------------------------------
-- 3. creator_social_accounts
-- ------------------------------------------------------------
INSERT INTO `creator_social_accounts` (`account_id`, `creator_id`, `platform`, `username`, `followers`, `engagement_rate`, `account_url`) VALUES
  (1, 1, 'Instagram', 'ananya.rao', 145000, 4.80, 'https://instagram.com/ananya.rao'),
  (2, 1, 'YouTube', 'AnanyaRao', 82000, 3.20, 'https://youtube.com/@AnanyaRao'),
  (3, 2, 'Instagram', 'rohan.tech', 210000, 5.10, 'https://instagram.com/rohan.tech'),
  (4, 2, 'YouTube', 'RohanMehtaTech', 175000, 4.40, 'https://youtube.com/@RohanMehtaTech'),
  (5, 2, 'LinkedIn', 'rohan-mehta', 45000, 2.10, 'https://linkedin.com/in/rohan-mehta'),
  (6, 3, 'Instagram', 'priya.wanders', 98000, 4.20, 'https://instagram.com/priya.wanders'),
  (7, 3, 'YouTube', 'PriyaNairTravel', 65000, 2.80, 'https://youtube.com/@PriyaNairTravel'),
  (8, 4, 'Instagram', 'arjun.fit', 132000, 4.60, 'https://instagram.com/arjun.fit'),
  (9, 4, 'YouTube', 'FitWithArjun', 70000, 3.10, 'https://youtube.com/@FitWithArjun'),
  (10, 5, 'Instagram', 'meera.glow', 118000, 4.90, 'https://instagram.com/meera.glow'),
  (11, 5, 'YouTube', 'MeeraIyerBeauty', 54000, 2.70, 'https://youtube.com/@MeeraIyerBeauty'),
  (12, 6, 'Instagram', 'kabir.codes', 160000, 5.30, 'https://instagram.com/kabir.codes'),
  (13, 6, 'LinkedIn', 'kabir-khan-dev', 62000, 2.40, 'https://linkedin.com/in/kabir-khan-dev'),
  (14, 7, 'Instagram', 'sneha.eats', 88000, 4.10, 'https://instagram.com/sneha.eats'),
  (15, 7, 'YouTube', 'SnehaPatelEats', 47000, 2.60, 'https://youtube.com/@SnehaPatelEats'),
  (16, 8, 'Instagram', 'aditya.finance', 76000, 3.90, 'https://instagram.com/aditya.finance'),
  (17, 8, 'LinkedIn', 'aditya-kulkarni-fin', 95000, 2.90, 'https://linkedin.com/in/aditya-kulkarni-fin'),
  (18, 8, 'YouTube', 'AdityaKulkarniFinance', 38000, 2.20, 'https://youtube.com/@AdityaKulkarniFinance')
ON DUPLICATE KEY UPDATE `account_id` = `account_id`;

-- ------------------------------------------------------------
-- 4. brands
-- ------------------------------------------------------------
INSERT INTO `brands` (`brand_id`, `user_id`, `brand_name`, `industry`, `contact_number`, `address`, `city`, `state`) VALUES
  (1, 10, 'NovaThread Apparel', 'Fashion', '+91-98765-10001', '5 MG Road', 'Bengaluru', 'Karnataka'),
  (2, 11, 'PixelForge Technologies', 'Technology', '+91-98765-10002', '88 Powai Business Park', 'Mumbai', 'Maharashtra'),
  (3, 12, 'Wanderly Travel Co.', 'Travel', '+91-98765-10003', '12 Miramar Beach Road', 'Panaji', 'Goa'),
  (4, 13, 'FitCore Nutrition', 'Fitness', '+91-98765-10004', '27 Connaught Place', 'New Delhi', 'Delhi'),
  (5, 14, 'GlowLeaf Naturals', 'Beauty', '+91-98765-10005', '44 T Nagar', 'Chennai', 'Tamil Nadu')
ON DUPLICATE KEY UPDATE `brand_id` = `brand_id`;

-- ------------------------------------------------------------
-- 5. campaign_categories
-- ------------------------------------------------------------
INSERT INTO `campaign_categories` (`category_id`, `category_name`, `description`) VALUES
  (1, 'Fashion', 'Apparel, accessories, styling, and seasonal fashion campaigns'),
  (2, 'Technology', 'Devices, software, developer tools, and consumer technology'),
  (3, 'Travel', 'Destinations, hospitality, travel gear, and tourism experiences'),
  (4, 'Fitness', 'Workout programs, sports gear, nutrition, and wellness'),
  (5, 'Beauty', 'Skincare, cosmetics, personal care, and clean beauty'),
  (6, 'Food & Lifestyle', 'Food, beverages, home cooking, and everyday lifestyle'),
  (7, 'Finance & Education', 'Personal finance, investing, learning, and career development')
ON DUPLICATE KEY UPDATE `category_id` = `category_id`;

-- ------------------------------------------------------------
-- 6. campaigns
-- ------------------------------------------------------------
INSERT INTO `campaigns` (`campaign_id`, `brand_id`, `category_id`, `campaign_name`, `description`, `budget`, `min_followers`, `start_date`, `end_date`, `status`, `max_creators`, `creator_limit`) VALUES
  (1, 1, 1, 'Summer Street Style 2026', 'Creators style NovaThread summer pieces in city and travel settings.', 250000.00, 10000, '2026-05-01', '2026-07-31', 'Completed', 4, 4),
  (2, 2, 2, 'Next-Gen Gadget Launch', 'Hands-on launch content for PixelForge flagship devices and accessories.', 500000.00, 25000, '2026-06-01', '2026-08-31', 'Completed', 3, 3),
  (3, 3, 3, 'Monsoon Escape Stories', 'Short-form travel stories about monsoon destinations and local stays.', 180000.00, 5000, '2026-07-01', '2026-09-30', 'Ongoing', 5, 5),
  (4, 4, 4, '30-Day Fitness Challenge', 'A month-long creator challenge around training, recovery, and nutrition.', 300000.00, 15000, '2026-08-01', '2026-10-31', 'Ongoing', 4, 4),
  (5, 5, 5, 'Clean Beauty Routine', 'Educational beauty content about ingredient labels and gentle routines.', 220000.00, 8000, '2026-09-01', '2026-11-30', 'Open', 6, 6),
  (6, 1, 1, 'Festive Ethnic Edit', 'Festive styling campaign for NovaThread ethnic and fusion collections.', 400000.00, 20000, '2026-09-15', '2026-12-15', 'Open', 5, 5),
  (7, 2, 2, 'Developer Productivity Hacks', 'Developer-focused content about tools, workflows, and productivity.', 150000.00, 10000, '2026-10-01', '2026-12-31', 'Open', 3, 3),
  (8, 3, 3, 'Hidden Beaches of India', 'Travel guide campaign featuring lesser-known coastal destinations.', 275000.00, 12000, '2026-04-15', '2026-06-30', 'Completed', 3, 3),
  (9, 4, 4, 'Home Workout Gear Guide', 'Practical reviews of compact home fitness equipment and routines.', 120000.00, 5000, '2026-03-01', '2026-05-31', 'Completed', 3, 3),
  (10, 5, 5, 'Ayurvedic Skincare Myths', 'Short videos separating traditional skincare claims from evidence.', 90000.00, 3000, '2026-08-15', '2026-10-15', 'Completed', 2, 2),
  (11, 2, 7, 'Personal Finance for Gen Z', 'Finance literacy content covering saving, budgeting, and first investments.', 100000.00, 5000, '2026-10-01', '2026-12-31', 'Open', 2, 2)
ON DUPLICATE KEY UPDATE `campaign_id` = `campaign_id`;

-- ------------------------------------------------------------
-- 7. campaign_requirements
-- ------------------------------------------------------------
INSERT INTO `campaign_requirements` (`requirement_id`, `campaign_id`, `platform`, `required_niche`, `min_engagement_rate`) VALUES
  (1, 1, 'Instagram', 'Fashion', 2.50),
  (2, 1, 'YouTube', 'Fashion', 1.50),
  (3, 2, 'YouTube', 'Technology', 2.00),
  (4, 2, 'Instagram', 'Technology', 3.00),
  (5, 3, 'Instagram', 'Travel', 2.00),
  (6, 3, 'YouTube', 'Travel', 1.00),
  (7, 4, 'Instagram', 'Fitness', 2.50),
  (8, 4, 'YouTube', 'Fitness', 1.50),
  (9, 5, 'Instagram', 'Beauty', 3.00),
  (10, 5, 'YouTube', 'Beauty', 1.00),
  (11, 6, 'Instagram', 'Fashion', 2.00),
  (12, 7, 'LinkedIn', 'Technology', 1.00),
  (13, 8, 'Instagram', 'Travel', 1.50),
  (14, 9, 'Instagram', 'Fitness', 2.00),
  (15, 10, 'Instagram', 'Beauty', 1.50),
  (16, 11, 'LinkedIn', 'Finance & Education', 1.00),
  (17, 1, 'Facebook', 'Fashion', 0.50)
ON DUPLICATE KEY UPDATE `requirement_id` = `requirement_id`;

-- ------------------------------------------------------------
-- 8. applications
-- ------------------------------------------------------------
INSERT INTO `applications` (`application_id`, `campaign_id`, `creator_id`, `applied_date`, `status`) VALUES
  (1, 1, 1, '2026-04-20', 'Accepted'),
  (2, 1, 5, '2026-04-21', 'Accepted'),
  (3, 1, 7, '2026-04-22', 'Accepted'),
  (4, 1, 8, '2026-04-23', 'Rejected'),
  (5, 2, 2, '2026-05-15', 'Accepted'),
  (6, 2, 6, '2026-05-16', 'Accepted'),
  (7, 2, 1, '2026-05-17', 'Rejected'),
  (8, 2, 8, '2026-05-18', 'Accepted'),
  (9, 3, 3, '2026-06-10', 'Accepted'),
  (10, 3, 7, '2026-06-11', 'Accepted'),
  (11, 3, 1, '2026-06-12', 'Pending'),
  (12, 3, 5, '2026-06-13', 'Rejected'),
  (13, 4, 4, '2026-07-10', 'Accepted'),
  (14, 4, 1, '2026-07-11', 'Accepted'),
  (15, 4, 6, '2026-07-12', 'Pending'),
  (16, 5, 5, '2026-08-10', 'Pending'),
  (17, 5, 7, '2026-08-11', 'Pending'),
  (18, 5, 1, '2026-08-12', 'Pending'),
  (19, 6, 1, '2026-08-20', 'Pending'),
  (20, 6, 5, '2026-08-21', 'Pending'),
  (21, 7, 2, '2026-09-01', 'Pending'),
  (22, 7, 6, '2026-09-02', 'Pending'),
  (23, 7, 8, '2026-09-03', 'Pending'),
  (24, 8, 3, '2026-04-01', 'Accepted'),
  (25, 8, 1, '2026-04-02', 'Accepted'),
  (26, 8, 7, '2026-04-03', 'Rejected'),
  (27, 9, 4, '2026-02-10', 'Accepted'),
  (28, 9, 7, '2026-02-11', 'Accepted'),
  (29, 9, 1, '2026-02-12', 'Rejected'),
  (30, 10, 5, '2026-07-25', 'Accepted'),
  (31, 10, 1, '2026-07-26', 'Rejected'),
  (32, 10, 7, '2026-07-27', 'Accepted'),
  (33, 11, 8, '2026-09-05', 'Pending'),
  (34, 11, 2, '2026-09-06', 'Pending')
ON DUPLICATE KEY UPDATE `application_id` = `application_id`;

-- ------------------------------------------------------------
-- 9. collaborations
-- Inserted as Active. Paid payments below fire the insert trigger and
-- complete collaborations 1-6 and 11-16.
-- ------------------------------------------------------------
INSERT INTO `collaborations` (`collaboration_id`, `application_id`, `agreed_amount`, `start_date`, `end_date`, `status`) VALUES
  (1, 1, 60000.00, '2026-05-05', '2026-07-20', 'Active'),
  (2, 2, 55000.00, '2026-05-06', '2026-07-21', 'Active'),
  (3, 3, 50000.00, '2026-05-07', '2026-07-22', 'Active'),
  (4, 5, 180000.00, '2026-06-05', '2026-08-25', 'Active'),
  (5, 6, 150000.00, '2026-06-06', '2026-08-26', 'Active'),
  (6, 8, 140000.00, '2026-06-07', '2026-08-27', 'Active'),
  (7, 9, 45000.00, '2026-07-05', '2026-09-20', 'Active'),
  (8, 10, 40000.00, '2026-07-06', '2026-09-21', 'Active'),
  (9, 13, 90000.00, '2026-08-05', '2026-10-25', 'Active'),
  (10, 14, 80000.00, '2026-08-06', '2026-10-26', 'Active'),
  (11, 24, 100000.00, '2026-04-20', '2026-06-25', 'Active'),
  (12, 25, 95000.00, '2026-04-21', '2026-06-26', 'Active'),
  (13, 27, 55000.00, '2026-03-05', '2026-05-25', 'Active'),
  (14, 28, 50000.00, '2026-03-06', '2026-05-26', 'Active'),
  (15, 30, 45000.00, '2026-08-20', '2026-10-10', 'Active'),
  (16, 32, 40000.00, '2026-08-21', '2026-10-11', 'Active')
ON DUPLICATE KEY UPDATE `collaboration_id` = `collaboration_id`;

-- ------------------------------------------------------------
-- 10. deliverables
-- ------------------------------------------------------------
INSERT INTO `deliverables` (`deliverable_id`, `collaboration_id`, `content_type`, `due_date`, `status`) VALUES
  (1, 1, 'Reel', '2026-05-20', 'Completed'),
  (2, 1, 'Story', '2026-06-01', 'Completed'),
  (3, 1, 'Post', '2026-06-15', 'Completed'),
  (4, 2, 'Reel', '2026-05-22', 'Completed'),
  (5, 2, 'Post', '2026-06-20', 'Completed'),
  (6, 3, 'Story', '2026-05-25', 'Completed'),
  (7, 3, 'Reel', '2026-06-25', 'Completed'),
  (8, 4, 'Video', '2026-06-20', 'Completed'),
  (9, 4, 'Reel', '2026-07-15', 'Completed'),
  (10, 5, 'Video', '2026-06-25', 'Completed'),
  (11, 5, 'Post', '2026-07-20', 'Completed'),
  (12, 6, 'Reel', '2026-07-01', 'Completed'),
  (13, 6, 'Story', '2026-07-25', 'Completed'),
  (14, 7, 'Reel', '2026-07-20', 'Completed'),
  (15, 7, 'Post', '2026-08-15', 'Pending'),
  (16, 8, 'Story', '2026-07-25', 'Completed'),
  (17, 8, 'Reel', '2026-08-20', 'Pending'),
  (18, 9, 'Reel', '2026-08-20', 'Completed'),
  (19, 9, 'Video', '2026-09-15', 'Pending'),
  (20, 10, 'Post', '2026-08-25', 'Completed'),
  (21, 10, 'Reel', '2026-09-20', 'Pending'),
  (22, 11, 'Reel', '2026-05-01', 'Completed'),
  (23, 11, 'Story', '2026-05-20', 'Completed'),
  (24, 12, 'Video', '2026-05-05', 'Completed'),
  (25, 12, 'Post', '2026-05-25', 'Completed'),
  (26, 13, 'Reel', '2026-03-20', 'Completed'),
  (27, 13, 'Post', '2026-04-15', 'Completed'),
  (28, 14, 'Story', '2026-03-25', 'Completed'),
  (29, 14, 'Reel', '2026-04-20', 'Completed'),
  (30, 15, 'Reel', '2026-09-05', 'Completed'),
  (31, 15, 'Post', '2026-09-25', 'Completed'),
  (32, 16, 'Story', '2026-09-10', 'Completed'),
  (33, 16, 'Reel', '2026-09-30', 'Completed')
ON DUPLICATE KEY UPDATE `deliverable_id` = `deliverable_id`;

-- ------------------------------------------------------------
-- 11. content_submissions
-- ------------------------------------------------------------
INSERT INTO `content_submissions` (`submission_id`, `deliverable_id`, `content_url`, `submitted_date`, `approval_status`) VALUES
  (1, 1, 'https://content.creatorconnect.local/submissions/D001-v1.mp4', '2026-05-16', 'Rejected'),
  (2, 1, 'https://content.creatorconnect.local/submissions/D001-v2.mp4', '2026-05-18', 'Approved'),
  (3, 2, 'https://content.creatorconnect.local/submissions/D002-v1.jpg', '2026-05-30', 'Approved'),
  (4, 3, 'https://content.creatorconnect.local/submissions/D003-v1.jpg', '2026-06-12', 'Approved'),
  (5, 4, 'https://content.creatorconnect.local/submissions/D004-v1.mp4', '2026-05-20', 'Approved'),
  (6, 5, 'https://content.creatorconnect.local/submissions/D005-v1.jpg', '2026-06-18', 'Approved'),
  (7, 6, 'https://content.creatorconnect.local/submissions/D006-v1.jpg', '2026-05-23', 'Approved'),
  (8, 7, 'https://content.creatorconnect.local/submissions/D007-v1.mp4', '2026-06-22', 'Approved'),
  (9, 8, 'https://content.creatorconnect.local/submissions/D008-v1.mp4', '2026-06-18', 'Approved'),
  (10, 9, 'https://content.creatorconnect.local/submissions/D009-v1.mp4', '2026-07-12', 'Approved'),
  (11, 10, 'https://content.creatorconnect.local/submissions/D010-v1.mp4', '2026-06-23', 'Approved'),
  (12, 11, 'https://content.creatorconnect.local/submissions/D011-v1.jpg', '2026-07-18', 'Approved'),
  (13, 12, 'https://content.creatorconnect.local/submissions/D012-v1.mp4', '2026-06-29', 'Approved'),
  (14, 13, 'https://content.creatorconnect.local/submissions/D013-v1.jpg', '2026-07-23', 'Approved'),
  (15, 14, 'https://content.creatorconnect.local/submissions/D014-v1.mp4', '2026-07-18', 'Approved'),
  (16, 15, 'https://content.creatorconnect.local/submissions/D015-v1.jpg', '2026-08-12', 'Pending'),
  (17, 16, 'https://content.creatorconnect.local/submissions/D016-v1.jpg', '2026-07-24', 'Approved'),
  (18, 17, 'https://content.creatorconnect.local/submissions/D017-v1.mp4', '2026-08-18', 'Pending'),
  (19, 18, 'https://content.creatorconnect.local/submissions/D018-v1.mp4', '2026-08-18', 'Approved'),
  (20, 19, 'https://content.creatorconnect.local/submissions/D019-v1.mp4', '2026-09-12', 'Pending'),
  (21, 20, 'https://content.creatorconnect.local/submissions/D020-v1.jpg', '2026-08-23', 'Approved'),
  (22, 21, 'https://content.creatorconnect.local/submissions/D021-v1.mp4', '2026-09-18', 'Pending'),
  (23, 22, 'https://content.creatorconnect.local/submissions/D022-v1.mp4', '2026-04-29', 'Approved'),
  (24, 23, 'https://content.creatorconnect.local/submissions/D023-v1.jpg', '2026-05-18', 'Approved'),
  (25, 24, 'https://content.creatorconnect.local/submissions/D024-v1.mp4', '2026-05-03', 'Approved'),
  (26, 25, 'https://content.creatorconnect.local/submissions/D025-v1.jpg', '2026-05-23', 'Approved'),
  (27, 26, 'https://content.creatorconnect.local/submissions/D026-v1.mp4', '2026-03-18', 'Approved'),
  (28, 27, 'https://content.creatorconnect.local/submissions/D027-v1.jpg', '2026-04-13', 'Approved'),
  (29, 28, 'https://content.creatorconnect.local/submissions/D028-v1.jpg', '2026-03-23', 'Approved'),
  (30, 29, 'https://content.creatorconnect.local/submissions/D029-v1.mp4', '2026-04-18', 'Approved'),
  (31, 30, 'https://content.creatorconnect.local/submissions/D030-v1.mp4', '2026-09-03', 'Approved'),
  (32, 31, 'https://content.creatorconnect.local/submissions/D031-v1.jpg', '2026-09-23', 'Approved'),
  (33, 32, 'https://content.creatorconnect.local/submissions/D032-v1.jpg', '2026-09-08', 'Approved'),
  (34, 33, 'https://content.creatorconnect.local/submissions/D033-v1.mp4', '2026-09-28', 'Approved'),
  (35, 1, 'https://content.creatorconnect.local/submissions/D001-v3.mp4', '2026-05-19', 'Approved')
ON DUPLICATE KEY UPDATE `submission_id` = `submission_id`;

-- ------------------------------------------------------------
-- 12. contracts
-- ------------------------------------------------------------
INSERT INTO `contracts` (`contract_id`, `collaboration_id`, `signed_date`, `expiry_date`, `contract_document`) VALUES
  (1, 1, '2026-05-05', '2026-07-20', 'https://contracts.creatorconnect.local/CTR-2026-001.pdf'),
  (2, 2, '2026-05-06', '2026-07-21', 'https://contracts.creatorconnect.local/CTR-2026-002.pdf'),
  (3, 3, '2026-05-07', '2026-07-22', 'https://contracts.creatorconnect.local/CTR-2026-003.pdf'),
  (4, 4, '2026-06-05', '2026-08-25', 'https://contracts.creatorconnect.local/CTR-2026-004.pdf'),
  (5, 5, '2026-06-06', '2026-08-26', 'https://contracts.creatorconnect.local/CTR-2026-005.pdf'),
  (6, 6, '2026-06-07', '2026-08-27', 'https://contracts.creatorconnect.local/CTR-2026-006.pdf'),
  (7, 7, '2026-07-05', '2026-09-20', 'https://contracts.creatorconnect.local/CTR-2026-007.pdf'),
  (8, 8, '2026-07-06', '2026-09-21', 'https://contracts.creatorconnect.local/CTR-2026-008.pdf'),
  (9, 9, '2026-08-05', '2026-10-25', 'https://contracts.creatorconnect.local/CTR-2026-009.pdf'),
  (10, 10, '2026-08-06', '2026-10-26', 'https://contracts.creatorconnect.local/CTR-2026-010.pdf'),
  (11, 11, '2026-04-20', '2026-06-25', 'https://contracts.creatorconnect.local/CTR-2026-011.pdf'),
  (12, 12, '2026-04-21', '2026-06-26', 'https://contracts.creatorconnect.local/CTR-2026-012.pdf'),
  (13, 13, '2026-03-05', '2026-05-25', 'https://contracts.creatorconnect.local/CTR-2026-013.pdf'),
  (14, 14, '2026-03-06', '2026-05-26', 'https://contracts.creatorconnect.local/CTR-2026-014.pdf'),
  (15, 15, '2026-08-20', '2026-10-10', 'https://contracts.creatorconnect.local/CTR-2026-015.pdf'),
  (16, 16, '2026-08-21', '2026-10-11', 'https://contracts.creatorconnect.local/CTR-2026-016.pdf')
ON DUPLICATE KEY UPDATE `contract_id` = `contract_id`;

-- ------------------------------------------------------------
-- 13. payments
-- Paid inserts fire complete_collaboration_after_payment_insert,
-- completing collaborations 1-6 and 11-16.
-- ------------------------------------------------------------
INSERT INTO `payments` (`payment_id`, `collaboration_id`, `amount`, `payment_date`, `status`, `transaction_reference`) VALUES
  (1, 1, 60000.00, '2026-07-22', 'Paid', 'PAY-2026-0001'),
  (2, 2, 55000.00, '2026-07-23', 'Paid', 'PAY-2026-0002'),
  (3, 3, 50000.00, '2026-07-24', 'Paid', 'PAY-2026-0003'),
  (4, 4, 90000.00, '2026-08-26', 'Paid', 'PAY-2026-0004'),
  (5, 4, 90000.00, '2026-08-30', 'Paid', 'PAY-2026-0005'),
  (6, 5, 150000.00, '2026-08-27', 'Paid', 'PAY-2026-0006'),
  (7, 6, 140000.00, '2026-08-28', 'Paid', 'PAY-2026-0007'),
  (8, 7, 45000.00, '2026-09-30', 'Pending', NULL),
  (9, 8, 40000.00, '2026-09-30', 'Pending', NULL),
  (10, 9, 90000.00, '2026-10-28', 'Pending', NULL),
  (11, 10, 80000.00, '2026-10-22', 'Pending', NULL),
  (12, 11, 100000.00, '2026-06-26', 'Paid', 'PAY-2026-0011'),
  (13, 12, 95000.00, '2026-06-27', 'Paid', 'PAY-2026-0012'),
  (14, 13, 55000.00, '2026-05-26', 'Paid', 'PAY-2026-0013'),
  (15, 14, 50000.00, '2026-05-27', 'Paid', 'PAY-2026-0014'),
  (16, 15, 45000.00, '2026-10-11', 'Paid', 'PAY-2026-0015'),
  (17, 16, 40000.00, '2026-10-12', 'Paid', 'PAY-2026-0016')
ON DUPLICATE KEY UPDATE `payment_id` = `payment_id`;

-- ------------------------------------------------------------
-- 14. performance_metrics (one row per collaboration)
-- ------------------------------------------------------------
INSERT INTO `performance_metrics` (`metric_id`, `collaboration_id`, `views`, `likes`, `comments`, `shares`, `clicks`) VALUES
  (1, 1, 125000, 9800, 450, 820, 3200),
  (2, 2, 98000, 7600, 380, 610, 2500),
  (3, 3, 87000, 6900, 310, 540, 2100),
  (4, 4, 240000, 18500, 920, 1600, 7100),
  (5, 5, 210000, 16200, 810, 1450, 6300),
  (6, 6, 190000, 14800, 760, 1320, 5800),
  (7, 7, 76000, 5400, 260, 430, 1800),
  (8, 8, 68000, 4900, 210, 380, 1600),
  (9, 9, 112000, 8600, 390, 700, 2800),
  (10, 10, 104000, 7900, 350, 640, 2600),
  (11, 11, 158000, 11200, 520, 980, 4100),
  (12, 12, 149000, 10400, 480, 910, 3900),
  (13, 13, 92000, 7100, 300, 560, 2300),
  (14, 14, 85000, 6500, 280, 510, 2100),
  (15, 15, 88000, 6800, 290, 520, 2200),
  (16, 16, 81000, 6100, 260, 470, 2000)
ON DUPLICATE KEY UPDATE `metric_id` = `metric_id`;

-- ------------------------------------------------------------
-- 15. reviews (completed collaborations)
-- ------------------------------------------------------------
INSERT INTO `reviews` (`review_id`, `collaboration_id`, `rating`, `feedback`, `review_date`) VALUES
  (1, 1, 5, 'Excellent styling content and clear brand integration. Delivered ahead of schedule.', '2026-07-25'),
  (2, 2, 4, 'Strong lifestyle visuals and good audience response. Minor revision was handled quickly.', '2026-07-28'),
  (3, 3, 4, 'Creative food and lifestyle storytelling with consistent quality across deliverables.', '2026-07-30'),
  (4, 4, 5, 'Detailed technology review with accurate specs and strong engagement.', '2026-08-30'),
  (5, 5, 4, 'Professional developer content and useful workflow examples.', '2026-08-31'),
  (6, 6, 5, 'Finance explainer was clear, accurate, and well received by the audience.', '2026-09-02'),
  (7, 11, 4, 'Beautiful destination coverage and reliable communication.', '2026-06-28'),
  (8, 12, 5, 'Outstanding visual storytelling and strong on-time delivery.', '2026-06-30'),
  (9, 13, 4, 'Practical home fitness content with good production quality.', '2026-05-28'),
  (10, 14, 3, 'Useful content overall, but one deliverable required a second revision.', '2026-05-30'),
  (11, 15, 5, 'Clear skincare education and excellent audience questions.', '2026-10-14'),
  (12, 16, 4, 'Good myth-busting format and consistent posting cadence.', '2026-10-15')
ON DUPLICATE KEY UPDATE `review_id` = `review_id`;

COMMIT;

-- ============================================================
-- End of seed data.
-- Next: database/03_basic_queries.sql
-- ============================================================
