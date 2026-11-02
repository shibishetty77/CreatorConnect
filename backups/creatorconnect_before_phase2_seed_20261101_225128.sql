-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: creatorconnect
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `creatorconnect`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `creatorconnect` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `creatorconnect`;

--
-- Table structure for table `applications`
--

DROP TABLE IF EXISTS `applications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `applications` (
  `application_id` int NOT NULL AUTO_INCREMENT,
  `campaign_id` int NOT NULL,
  `creator_id` int NOT NULL,
  `applied_date` date DEFAULT (curdate()),
  `status` enum('Pending','Accepted','Rejected') DEFAULT 'Pending',
  PRIMARY KEY (`application_id`),
  UNIQUE KEY `uq_campaign_creator` (`campaign_id`,`creator_id`),
  KEY `idx_application_status` (`status`),
  KEY `idx_application_campaign` (`campaign_id`),
  KEY `idx_application_creator` (`creator_id`),
  CONSTRAINT `fk_application_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`campaign_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_application_creator` FOREIGN KEY (`creator_id`) REFERENCES `creators` (`creator_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `applications`
--

LOCK TABLES `applications` WRITE;
/*!40000 ALTER TABLE `applications` DISABLE KEYS */;
/*!40000 ALTER TABLE `applications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `brands`
--

DROP TABLE IF EXISTS `brands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `brands` (
  `brand_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `brand_name` varchar(150) NOT NULL,
  `industry` varchar(100) DEFAULT NULL,
  `contact_number` varchar(15) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`brand_id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_brands_industry` (`industry`),
  KEY `idx_brands_city` (`city`),
  CONSTRAINT `fk_brand_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `brands`
--

LOCK TABLES `brands` WRITE;
/*!40000 ALTER TABLE `brands` DISABLE KEYS */;
/*!40000 ALTER TABLE `brands` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `campaign_categories`
--

DROP TABLE IF EXISTS `campaign_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_categories` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `category_name` (`category_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaign_categories`
--

LOCK TABLES `campaign_categories` WRITE;
/*!40000 ALTER TABLE `campaign_categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `campaign_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `campaign_creator_summary`
--

DROP TABLE IF EXISTS `campaign_creator_summary`;
/*!50001 DROP VIEW IF EXISTS `campaign_creator_summary`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `campaign_creator_summary` AS SELECT 
 1 AS `campaign_id`,
 1 AS `campaign_name`,
 1 AS `brand_id`,
 1 AS `creator_id`,
 1 AS `first_name`,
 1 AS `last_name`,
 1 AS `application_id`,
 1 AS `applied_date`,
 1 AS `application_status`,
 1 AS `collaboration_id`,
 1 AS `agreed_amount`,
 1 AS `collaboration_start_date`,
 1 AS `collaboration_end_date`,
 1 AS `collaboration_status`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `campaign_requirements`
--

DROP TABLE IF EXISTS `campaign_requirements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_requirements` (
  `requirement_id` int NOT NULL AUTO_INCREMENT,
  `campaign_id` int NOT NULL,
  `platform` enum('Instagram','YouTube','LinkedIn','Twitter','Facebook') NOT NULL,
  `required_niche` varchar(100) DEFAULT NULL,
  `min_engagement_rate` decimal(5,2) DEFAULT '0.00',
  PRIMARY KEY (`requirement_id`),
  KEY `fk_requirement_campaign` (`campaign_id`),
  CONSTRAINT `fk_requirement_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`campaign_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_requirement_engagement` CHECK (((`min_engagement_rate` >= 0) and (`min_engagement_rate` <= 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaign_requirements`
--

LOCK TABLES `campaign_requirements` WRITE;
/*!40000 ALTER TABLE `campaign_requirements` DISABLE KEYS */;
/*!40000 ALTER TABLE `campaign_requirements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `campaigns`
--

DROP TABLE IF EXISTS `campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaigns` (
  `campaign_id` int NOT NULL AUTO_INCREMENT,
  `brand_id` int NOT NULL,
  `category_id` int DEFAULT NULL,
  `campaign_name` varchar(150) NOT NULL,
  `description` text,
  `budget` decimal(12,2) NOT NULL,
  `min_followers` bigint DEFAULT '0',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('Open','Ongoing','Completed') DEFAULT 'Open',
  `max_creators` int DEFAULT '1',
  `creator_limit` int DEFAULT '1',
  PRIMARY KEY (`campaign_id`),
  KEY `idx_campaign_name` (`campaign_name`),
  KEY `idx_campaign_status` (`status`),
  KEY `idx_campaign_dates` (`start_date`,`end_date`),
  KEY `idx_campaign_brand` (`brand_id`),
  KEY `idx_campaign_category` (`category_id`),
  CONSTRAINT `fk_campaign_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`brand_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_campaign_category` FOREIGN KEY (`category_id`) REFERENCES `campaign_categories` (`category_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_campaign_budget` CHECK ((`budget` > 0)),
  CONSTRAINT `chk_campaign_dates` CHECK ((`end_date` >= `start_date`)),
  CONSTRAINT `chk_campaign_followers` CHECK ((`min_followers` >= 0)),
  CONSTRAINT `chk_creator_limit` CHECK ((`creator_limit` > 0)),
  CONSTRAINT `chk_max_creators` CHECK ((`max_creators` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campaigns`
--

LOCK TABLES `campaigns` WRITE;
/*!40000 ALTER TABLE `campaigns` DISABLE KEYS */;
/*!40000 ALTER TABLE `campaigns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `collaborations`
--

DROP TABLE IF EXISTS `collaborations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `collaborations` (
  `collaboration_id` int NOT NULL AUTO_INCREMENT,
  `application_id` int NOT NULL,
  `agreed_amount` decimal(12,2) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('Active','Completed') DEFAULT 'Active',
  PRIMARY KEY (`collaboration_id`),
  UNIQUE KEY `application_id` (`application_id`),
  KEY `idx_collaboration_status` (`status`),
  CONSTRAINT `fk_collaboration_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`application_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_agreed_amount` CHECK ((`agreed_amount` >= 0)),
  CONSTRAINT `chk_collaboration_dates` CHECK ((`end_date` >= `start_date`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `collaborations`
--

LOCK TABLES `collaborations` WRITE;
/*!40000 ALTER TABLE `collaborations` DISABLE KEYS */;
/*!40000 ALTER TABLE `collaborations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `content_submissions`
--

DROP TABLE IF EXISTS `content_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_submissions` (
  `submission_id` int NOT NULL AUTO_INCREMENT,
  `deliverable_id` int NOT NULL,
  `content_url` varchar(500) NOT NULL,
  `submitted_date` date DEFAULT (curdate()),
  `approval_status` enum('Pending','Approved','Rejected') DEFAULT 'Pending',
  PRIMARY KEY (`submission_id`),
  KEY `fk_submission_deliverable` (`deliverable_id`),
  CONSTRAINT `fk_submission_deliverable` FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables` (`deliverable_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `content_submissions`
--

LOCK TABLES `content_submissions` WRITE;
/*!40000 ALTER TABLE `content_submissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `content_submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contracts`
--

DROP TABLE IF EXISTS `contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contracts` (
  `contract_id` int NOT NULL AUTO_INCREMENT,
  `collaboration_id` int NOT NULL,
  `signed_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `contract_document` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`contract_id`),
  UNIQUE KEY `collaboration_id` (`collaboration_id`),
  CONSTRAINT `fk_contract_collaboration` FOREIGN KEY (`collaboration_id`) REFERENCES `collaborations` (`collaboration_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_contract_dates` CHECK (((`expiry_date` is null) or (`signed_date` is null) or (`expiry_date` >= `signed_date`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contracts`
--

LOCK TABLES `contracts` WRITE;
/*!40000 ALTER TABLE `contracts` DISABLE KEYS */;
/*!40000 ALTER TABLE `contracts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `creator_social_accounts`
--

DROP TABLE IF EXISTS `creator_social_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `creator_social_accounts` (
  `account_id` int NOT NULL AUTO_INCREMENT,
  `creator_id` int NOT NULL,
  `platform` enum('Instagram','YouTube','LinkedIn','Twitter','Facebook') NOT NULL,
  `username` varchar(100) NOT NULL,
  `followers` bigint DEFAULT '0',
  `engagement_rate` decimal(5,2) DEFAULT '0.00',
  `account_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`account_id`),
  KEY `fk_social_creator` (`creator_id`),
  KEY `idx_social_platform` (`platform`),
  KEY `idx_social_followers` (`followers`),
  CONSTRAINT `fk_social_creator` FOREIGN KEY (`creator_id`) REFERENCES `creators` (`creator_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_engagement_rate` CHECK (((`engagement_rate` >= 0) and (`engagement_rate` <= 100))),
  CONSTRAINT `chk_followers` CHECK ((`followers` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `creator_social_accounts`
--

LOCK TABLES `creator_social_accounts` WRITE;
/*!40000 ALTER TABLE `creator_social_accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `creator_social_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `creators`
--

DROP TABLE IF EXISTS `creators`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `creators` (
  `creator_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `date_of_birth` date DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `bio` text,
  `address` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `profile_picture_url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`creator_id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_creators_last_name` (`last_name`),
  KEY `idx_creators_city` (`city`),
  CONSTRAINT `fk_creator_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `creators`
--

LOCK TABLES `creators` WRITE;
/*!40000 ALTER TABLE `creators` DISABLE KEYS */;
/*!40000 ALTER TABLE `creators` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deliverables`
--

DROP TABLE IF EXISTS `deliverables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deliverables` (
  `deliverable_id` int NOT NULL AUTO_INCREMENT,
  `collaboration_id` int NOT NULL,
  `content_type` enum('Reel','Story','Post','Video') NOT NULL,
  `due_date` date NOT NULL,
  `status` enum('Pending','Completed') DEFAULT 'Pending',
  PRIMARY KEY (`deliverable_id`),
  KEY `fk_deliverable_collaboration` (`collaboration_id`),
  CONSTRAINT `fk_deliverable_collaboration` FOREIGN KEY (`collaboration_id`) REFERENCES `collaborations` (`collaboration_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deliverables`
--

LOCK TABLES `deliverables` WRITE;
/*!40000 ALTER TABLE `deliverables` DISABLE KEYS */;
/*!40000 ALTER TABLE `deliverables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `payment_id` int NOT NULL AUTO_INCREMENT,
  `collaboration_id` int NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` date DEFAULT NULL,
  `status` enum('Pending','Paid') DEFAULT 'Pending',
  `transaction_reference` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`payment_id`),
  KEY `fk_payment_collaboration` (`collaboration_id`),
  KEY `idx_payment_status` (`status`),
  KEY `idx_payment_date` (`payment_date`),
  CONSTRAINT `fk_payment_collaboration` FOREIGN KEY (`collaboration_id`) REFERENCES `collaborations` (`collaboration_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_payment_amount` CHECK ((`amount` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `complete_collaboration_after_payment_insert` AFTER INSERT ON `payments` FOR EACH ROW BEGIN

    IF NEW.status = 'Paid' THEN

        UPDATE Collaborations
        SET status = 'Completed'
        WHERE collaboration_id = NEW.collaboration_id;

    END IF;

END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `update_collaboration_after_payment` AFTER UPDATE ON `payments` FOR EACH ROW BEGIN

    IF NEW.status = 'Paid'
       AND OLD.status <> 'Paid' THEN

        UPDATE Collaborations
        SET status = 'Completed'
        WHERE collaboration_id = NEW.collaboration_id;

    END IF;

END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `performance_metrics`
--

DROP TABLE IF EXISTS `performance_metrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `performance_metrics` (
  `metric_id` int NOT NULL AUTO_INCREMENT,
  `collaboration_id` int NOT NULL,
  `views` bigint DEFAULT '0',
  `likes` bigint DEFAULT '0',
  `comments` bigint DEFAULT '0',
  `shares` bigint DEFAULT '0',
  `clicks` bigint DEFAULT '0',
  PRIMARY KEY (`metric_id`),
  UNIQUE KEY `collaboration_id` (`collaboration_id`),
  CONSTRAINT `fk_metrics_collaboration` FOREIGN KEY (`collaboration_id`) REFERENCES `collaborations` (`collaboration_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_clicks` CHECK ((`clicks` >= 0)),
  CONSTRAINT `chk_comments` CHECK ((`comments` >= 0)),
  CONSTRAINT `chk_likes` CHECK ((`likes` >= 0)),
  CONSTRAINT `chk_shares` CHECK ((`shares` >= 0)),
  CONSTRAINT `chk_views` CHECK ((`views` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `performance_metrics`
--

LOCK TABLES `performance_metrics` WRITE;
/*!40000 ALTER TABLE `performance_metrics` DISABLE KEYS */;
/*!40000 ALTER TABLE `performance_metrics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `review_id` int NOT NULL AUTO_INCREMENT,
  `collaboration_id` int NOT NULL,
  `rating` int NOT NULL,
  `feedback` text,
  `review_date` date DEFAULT (curdate()),
  PRIMARY KEY (`review_id`),
  UNIQUE KEY `collaboration_id` (`collaboration_id`),
  KEY `idx_review_rating` (`rating`),
  CONSTRAINT `fk_review_collaboration` FOREIGN KEY (`collaboration_id`) REFERENCES `collaborations` (`collaboration_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_review_rating` CHECK ((`rating` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('Admin','Brand','Creator') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'creatorconnect'
--
/*!50003 DROP PROCEDURE IF EXISTS `get_campaign_creators` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `get_campaign_creators`(
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

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Current Database: `creatorconnect`
--

USE `creatorconnect`;

--
-- Final view structure for view `campaign_creator_summary`
--

/*!50001 DROP VIEW IF EXISTS `campaign_creator_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `campaign_creator_summary` AS select `c`.`campaign_id` AS `campaign_id`,`c`.`campaign_name` AS `campaign_name`,`c`.`brand_id` AS `brand_id`,`cr`.`creator_id` AS `creator_id`,`cr`.`first_name` AS `first_name`,`cr`.`last_name` AS `last_name`,`a`.`application_id` AS `application_id`,`a`.`applied_date` AS `applied_date`,`a`.`status` AS `application_status`,`co`.`collaboration_id` AS `collaboration_id`,`co`.`agreed_amount` AS `agreed_amount`,`co`.`start_date` AS `collaboration_start_date`,`co`.`end_date` AS `collaboration_end_date`,`co`.`status` AS `collaboration_status` from (((`campaigns` `c` join `applications` `a` on((`c`.`campaign_id` = `a`.`campaign_id`))) join `creators` `cr` on((`a`.`creator_id` = `cr`.`creator_id`))) left join `collaborations` `co` on((`a`.`application_id` = `co`.`application_id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-01 22:51:28
