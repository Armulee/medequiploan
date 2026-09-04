CREATE TABLE IF NOT EXISTS "rate_limits" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);

-- Lets the periodic sweep of expired buckets use an index instead of a scan.
CREATE INDEX IF NOT EXISTS "rate_limits_window_start_idx" ON "rate_limits" ("window_start");
