CREATE TABLE `import_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`format` text NOT NULL,
	`imported_at` text NOT NULL,
	`row_count` integer,
	`field_mapping` text
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`grid_ref` text,
	`lat` real,
	`lon` real,
	`country` text,
	`region` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `sightings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_batch_id` integer,
	`location_id` integer,
	`species` text NOT NULL,
	`common_name` text,
	`scientific_name` text,
	`order` text,
	`family` text,
	`date` text NOT NULL,
	`time` text,
	`count` integer,
	`count_approx` integer,
	`sex` text,
	`age` text,
	`breeding` text,
	`ring` text,
	`notes` text,
	`observer` text,
	`source_ref` text,
	`lat` real,
	`lon` real,
	`raw_data` text,
	FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
