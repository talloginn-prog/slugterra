CREATE TABLE `player_progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`progress` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
