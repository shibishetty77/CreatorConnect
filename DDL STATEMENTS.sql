/* ============================================================
   CREATORCONNECT
   Creator & Brand Sponsorship Collaboration Management System

   DBMS Mini Project
   Database: MySQL 8.0+
   ============================================================ */


/* ============================================================
   1. DATABASE CREATION
   ============================================================ */

DROP DATABASE IF EXISTS creatorconnect;

CREATE DATABASE creatorconnect;

USE creatorconnect;


/* ============================================================
   2. USERS TABLE
   ============================================================ */

CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,

    username VARCHAR(50) NOT NULL UNIQUE,

    email VARCHAR(100) NOT NULL UNIQUE,

    password_hash VARCHAR(255) NOT NULL,

    role ENUM('Admin', 'Brand', 'Creator') NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


/* ============================================================
   3. CREATORS TABLE
   ============================================================ */

CREATE TABLE Creators (
    creator_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL UNIQUE,

    first_name VARCHAR(50) NOT NULL,

    last_name VARCHAR(50) NOT NULL,

    date_of_birth DATE,

    phone VARCHAR(15),

    bio TEXT,

    address VARCHAR(255),

    city VARCHAR(100),

    state VARCHAR(100),

    CONSTRAINT fk_creator_user
        FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   4. CREATOR SOCIAL ACCOUNTS TABLE
   ============================================================ */

CREATE TABLE Creator_Social_Accounts (
    account_id INT AUTO_INCREMENT PRIMARY KEY,

    creator_id INT NOT NULL,

    platform ENUM(
        'Instagram',
        'YouTube',
        'LinkedIn',
        'Twitter',
        'Facebook'
    ) NOT NULL,

    username VARCHAR(100) NOT NULL,

    followers BIGINT DEFAULT 0,

    engagement_rate DECIMAL(5,2) DEFAULT 0.00,

    account_url VARCHAR(255),

    CONSTRAINT chk_followers
        CHECK (followers >= 0),

    CONSTRAINT chk_engagement_rate
        CHECK (
            engagement_rate >= 0
            AND engagement_rate <= 100
        ),

    CONSTRAINT fk_social_creator
        FOREIGN KEY (creator_id)
        REFERENCES Creators(creator_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   5. BRANDS TABLE
   ============================================================ */

CREATE TABLE Brands (
    brand_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL UNIQUE,

    brand_name VARCHAR(150) NOT NULL,

    industry VARCHAR(100),

    contact_number VARCHAR(15),

    address VARCHAR(255),

    city VARCHAR(100),

    state VARCHAR(100),

    CONSTRAINT fk_brand_user
        FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   6. CAMPAIGN CATEGORIES TABLE
   ============================================================ */

CREATE TABLE Campaign_Categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,

    category_name VARCHAR(100) NOT NULL UNIQUE,

    description VARCHAR(255)
);


/* ============================================================
   7. CAMPAIGNS TABLE
   ============================================================ */

CREATE TABLE Campaigns (
    campaign_id INT AUTO_INCREMENT PRIMARY KEY,

    brand_id INT NOT NULL,

    category_id INT,

    campaign_name VARCHAR(150) NOT NULL,

    description TEXT,

    budget DECIMAL(12,2) NOT NULL,

    min_followers BIGINT DEFAULT 0,

    start_date DATE NOT NULL,

    end_date DATE NOT NULL,

    status ENUM(
        'Open',
        'Ongoing',
        'Completed'
    ) DEFAULT 'Open',

    CONSTRAINT chk_campaign_budget
        CHECK (budget > 0),

    CONSTRAINT chk_campaign_followers
        CHECK (min_followers >= 0),

    CONSTRAINT chk_campaign_dates
        CHECK (end_date >= start_date),

    CONSTRAINT fk_campaign_brand
        FOREIGN KEY (brand_id)
        REFERENCES Brands(brand_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_campaign_category
        FOREIGN KEY (category_id)
        REFERENCES Campaign_Categories(category_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);


/* ============================================================
   8. CAMPAIGN REQUIREMENTS TABLE
   ============================================================ */

CREATE TABLE Campaign_Requirements (
    requirement_id INT AUTO_INCREMENT PRIMARY KEY,

    campaign_id INT NOT NULL,

    platform ENUM(
        'Instagram',
        'YouTube',
        'LinkedIn',
        'Twitter',
        'Facebook'
    ) NOT NULL,

    required_niche VARCHAR(100),

    min_engagement_rate DECIMAL(5,2) DEFAULT 0.00,

    CONSTRAINT chk_requirement_engagement
        CHECK (
            min_engagement_rate >= 0
            AND min_engagement_rate <= 100
        ),

    CONSTRAINT fk_requirement_campaign
        FOREIGN KEY (campaign_id)
        REFERENCES Campaigns(campaign_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   9. APPLICATIONS TABLE
   ============================================================ */

CREATE TABLE Applications (
    application_id INT AUTO_INCREMENT PRIMARY KEY,

    campaign_id INT NOT NULL,

    creator_id INT NOT NULL,

    applied_date DATE DEFAULT (CURRENT_DATE),

    status ENUM(
        'Pending',
        'Accepted',
        'Rejected'
    ) DEFAULT 'Pending',

    CONSTRAINT uq_campaign_creator
        UNIQUE (campaign_id, creator_id),

    CONSTRAINT fk_application_campaign
        FOREIGN KEY (campaign_id)
        REFERENCES Campaigns(campaign_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_application_creator
        FOREIGN KEY (creator_id)
        REFERENCES Creators(creator_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   10. COLLABORATIONS TABLE
   ============================================================ */

CREATE TABLE Collaborations (
    collaboration_id INT AUTO_INCREMENT PRIMARY KEY,

    application_id INT NOT NULL UNIQUE,

    agreed_amount DECIMAL(12,2) NOT NULL,

    start_date DATE NOT NULL,

    end_date DATE NOT NULL,

    status ENUM(
        'Active',
        'Completed'
    ) DEFAULT 'Active',

    CONSTRAINT chk_agreed_amount
        CHECK (agreed_amount >= 0),

    CONSTRAINT chk_collaboration_dates
        CHECK (end_date >= start_date),

    CONSTRAINT fk_collaboration_application
        FOREIGN KEY (application_id)
        REFERENCES Applications(application_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   11. DELIVERABLES TABLE
   ============================================================ */

CREATE TABLE Deliverables (
    deliverable_id INT AUTO_INCREMENT PRIMARY KEY,

    collaboration_id INT NOT NULL,

    content_type ENUM(
        'Reel',
        'Story',
        'Post',
        'Video'
    ) NOT NULL,

    due_date DATE NOT NULL,

    status ENUM(
        'Pending',
        'Completed'
    ) DEFAULT 'Pending',

    CONSTRAINT fk_deliverable_collaboration
        FOREIGN KEY (collaboration_id)
        REFERENCES Collaborations(collaboration_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   12. CONTENT SUBMISSIONS TABLE
   ============================================================ */

CREATE TABLE Content_Submissions (
    submission_id INT AUTO_INCREMENT PRIMARY KEY,

    deliverable_id INT NOT NULL,

    content_url VARCHAR(500) NOT NULL,

    submitted_date DATE DEFAULT (CURRENT_DATE),

    approval_status ENUM(
        'Pending',
        'Approved',
        'Rejected'
    ) DEFAULT 'Pending',

    CONSTRAINT fk_submission_deliverable
        FOREIGN KEY (deliverable_id)
        REFERENCES Deliverables(deliverable_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   13. CONTRACTS TABLE
   ============================================================ */

CREATE TABLE Contracts (
    contract_id INT AUTO_INCREMENT PRIMARY KEY,

    collaboration_id INT NOT NULL UNIQUE,

    signed_date DATE,

    expiry_date DATE,

    contract_document VARCHAR(500),

    CONSTRAINT chk_contract_dates
        CHECK (
            expiry_date IS NULL
            OR signed_date IS NULL
            OR expiry_date >= signed_date
        ),

    CONSTRAINT fk_contract_collaboration
        FOREIGN KEY (collaboration_id)
        REFERENCES Collaborations(collaboration_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   14. PAYMENTS TABLE
   ============================================================ */

CREATE TABLE Payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,

    collaboration_id INT NOT NULL,

    amount DECIMAL(12,2) NOT NULL,

    payment_date DATE,

    status ENUM(
        'Pending',
        'Paid'
    ) DEFAULT 'Pending',

    transaction_reference VARCHAR(100),

    CONSTRAINT chk_payment_amount
        CHECK (amount >= 0),

    CONSTRAINT fk_payment_collaboration
        FOREIGN KEY (collaboration_id)
        REFERENCES Collaborations(collaboration_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   15. PERFORMANCE METRICS TABLE
   ============================================================ */

CREATE TABLE Performance_Metrics (
    metric_id INT AUTO_INCREMENT PRIMARY KEY,

    collaboration_id INT NOT NULL UNIQUE,

    views BIGINT DEFAULT 0,

    likes BIGINT DEFAULT 0,

    comments BIGINT DEFAULT 0,

    shares BIGINT DEFAULT 0,

    clicks BIGINT DEFAULT 0,

    CONSTRAINT chk_views
        CHECK (views >= 0),

    CONSTRAINT chk_likes
        CHECK (likes >= 0),

    CONSTRAINT chk_comments
        CHECK (comments >= 0),

    CONSTRAINT chk_shares
        CHECK (shares >= 0),

    CONSTRAINT chk_clicks
        CHECK (clicks >= 0),

    CONSTRAINT fk_metrics_collaboration
        FOREIGN KEY (collaboration_id)
        REFERENCES Collaborations(collaboration_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   16. REVIEWS TABLE
   ============================================================ */

CREATE TABLE Reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,

    collaboration_id INT NOT NULL UNIQUE,

    rating INT NOT NULL,

    feedback TEXT,

    review_date DATE DEFAULT (CURRENT_DATE),

    CONSTRAINT chk_review_rating
        CHECK (rating BETWEEN 1 AND 5),

    CONSTRAINT fk_review_collaboration
        FOREIGN KEY (collaboration_id)
        REFERENCES Collaborations(collaboration_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


/* ============================================================
   17. ALTER TABLE
   ============================================================ */

/* Add profile picture URL to Creators */

ALTER TABLE Creators
ADD COLUMN profile_picture_url VARCHAR(500);


/* Add creator limit to Campaigns */

ALTER TABLE Campaigns
ADD COLUMN creator_limit INT DEFAULT 1;


/* Add CHECK constraint for creator limit */

ALTER TABLE Campaigns
ADD CONSTRAINT chk_creator_limit
CHECK (creator_limit > 0);


/* ============================================================
   18. INDEXES
   ============================================================ */

/* Users */

CREATE INDEX idx_users_role
ON Users(role);


/* Creators */

CREATE INDEX idx_creators_last_name
ON Creators(last_name);

CREATE INDEX idx_creators_city
ON Creators(city);


/* Creator Social Accounts */

CREATE INDEX idx_social_platform
ON Creator_Social_Accounts(platform);

CREATE INDEX idx_social_followers
ON Creator_Social_Accounts(followers);


/* Brands */

CREATE INDEX idx_brands_industry
ON Brands(industry);

CREATE INDEX idx_brands_city
ON Brands(city);


/* Campaigns */

CREATE INDEX idx_campaign_name
ON Campaigns(campaign_name);

CREATE INDEX idx_campaign_status
ON Campaigns(status);

CREATE INDEX idx_campaign_dates
ON Campaigns(start_date, end_date);

CREATE INDEX idx_campaign_brand
ON Campaigns(brand_id);

CREATE INDEX idx_campaign_category
ON Campaigns(category_id);


/* Applications */

CREATE INDEX idx_application_status
ON Applications(status);

CREATE INDEX idx_application_campaign
ON Applications(campaign_id);

CREATE INDEX idx_application_creator
ON Applications(creator_id);


/* Collaborations */

CREATE INDEX idx_collaboration_status
ON Collaborations(status);


/* Payments */

CREATE INDEX idx_payment_status
ON Payments(status);

CREATE INDEX idx_payment_date
ON Payments(payment_date);


/* Reviews */

CREATE INDEX idx_review_rating
ON Reviews(rating);


/* ============================================================
   19. TRIGGER 1
   Automatically complete a collaboration when an existing
   payment changes from Pending to Paid
   ============================================================ */

DELIMITER $$

CREATE TRIGGER update_collaboration_after_payment
AFTER UPDATE ON Payments
FOR EACH ROW
BEGIN

    IF NEW.status = 'Paid'
       AND OLD.status <> 'Paid' THEN

        UPDATE Collaborations
        SET status = 'Completed'
        WHERE collaboration_id = NEW.collaboration_id;

    END IF;

END$$

DELIMITER ;


/* ============================================================
   20. TRIGGER 2
   Automatically complete a collaboration when a new
   payment is inserted with Paid status
   ============================================================ */

DELIMITER $$

CREATE TRIGGER complete_collaboration_after_payment_insert
AFTER INSERT ON Payments
FOR EACH ROW
BEGIN

    IF NEW.status = 'Paid' THEN

        UPDATE Collaborations
        SET status = 'Completed'
        WHERE collaboration_id = NEW.collaboration_id;

    END IF;

END$$

DELIMITER ;


/* ============================================================
   21. STORED PROCEDURE
   Returns all creators who applied for a campaign
   ============================================================ */

DELIMITER $$

CREATE PROCEDURE get_campaign_creators(
    IN p_campaign_id INT
)
BEGIN

    SELECT
        c.creator_id,
        c.first_name,
        c.last_name,
        c.city,
        a.application_id,
        a.applied_date,
        a.status AS application_status

    FROM Creators c

    INNER JOIN Applications a
        ON c.creator_id = a.creator_id

    WHERE a.campaign_id = p_campaign_id

    ORDER BY a.applied_date DESC;

END$$

DELIMITER ;


/* ============================================================
   22. VIEW
   Campaign and creator collaboration summary
   ============================================================ */

CREATE VIEW campaign_creator_summary AS

SELECT
    c.campaign_id,
    c.campaign_name,
    c.brand_id,

    cr.creator_id,
    cr.first_name,
    cr.last_name,

    a.application_id,
    a.applied_date,
    a.status AS application_status,

    co.collaboration_id,
    co.agreed_amount,

    co.start_date AS collaboration_start_date,
    co.end_date AS collaboration_end_date,

    co.status AS collaboration_status

FROM Campaigns c

INNER JOIN Applications a
    ON c.campaign_id = a.campaign_id

INNER JOIN Creators cr
    ON a.creator_id = cr.creator_id

LEFT JOIN Collaborations co
    ON a.application_id = co.application_id;


/* ============================================================
   23. VERIFICATION
   ============================================================ */


/* Verify all 15 tables */

SHOW TABLES;


/* Verify triggers */

SHOW TRIGGERS;


/* Verify stored procedure */

SHOW PROCEDURE STATUS
WHERE Db = 'creatorconnect';


/* Verify view */

SHOW FULL TABLES
WHERE Table_type = 'VIEW';


/* ============================================================
   END OF CREATORCONNECT DDL
   ============================================================ */