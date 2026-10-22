CREATE TABLE IF NOT EXISTS `books` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(191) NOT NULL,
	`title` varchar(255) NOT NULL,
	`author` varchar(255) NOT NULL,
	`synopsis` text,
	`review` mediumtext,
	`rating` tinyint unsigned NOT NULL DEFAULT 0,
	`pages` smallint unsigned,
	`width_px` smallint unsigned,
	`height_px` smallint unsigned,
	`spine_color` char(7) NOT NULL DEFAULT '#7ab8e0',
	`spine_text_color` char(7) NOT NULL DEFAULT '#fdfaf4',
	`cover_image` mediumblob,
	`cover_mime` varchar(64),
	`spine_image` mediumblob,
	`spine_mime` varchar(64),
	`spine_ratio` decimal(5,3),
	`date_read` date,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`category_id` int unsigned,
	`position` int unsigned NOT NULL DEFAULT 0,
	PRIMARY KEY(`id`),
	UNIQUE KEY `uq_books_slug` (`slug`),
	KEY `idx_books_author` (`author`),
	KEY `idx_books_rating` (`rating`),
	KEY `idx_books_date_read` (`date_read`),
	KEY `idx_books_category` (`category_id`,`position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `categories` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`position` int unsigned NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `images` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`mime` varchar(64) NOT NULL,
	`data` mediumblob NOT NULL,
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
