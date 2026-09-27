-- Additive and isolated: old public schema and old accounts are untouched.
CREATE SCHEMA IF NOT EXISTS yj_platform_v1;
SET LOCAL search_path TO yj_platform_v1, pg_catalog;
CREATE TABLE IF NOT EXISTS "analysis_results" (
	"game_id" bigint PRIMARY KEY NOT NULL,
	"away" bigint NOT NULL,
	"home" bigint NOT NULL,
	"fetched_at" text NOT NULL
);


CREATE TABLE IF NOT EXISTS "analysis_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" bigint NOT NULL,
	"start_time" text NOT NULL,
	"captured_at" text NOT NULL,
	"version" text NOT NULL,
	"payload" text NOT NULL
);


CREATE INDEX IF NOT EXISTS "analysis_game_captured" ON "analysis_snapshots" ("game_id","captured_at");

CREATE INDEX IF NOT EXISTS "analysis_start" ON "analysis_snapshots" ("start_time");
ALTER TABLE "analysis_results" ADD COLUMN IF NOT EXISTS "scheduled_start" text;
CREATE TABLE IF NOT EXISTS "tz_binding_attempts" (
	"member_id" text PRIMARY KEY NOT NULL,
	"allowed_at" bigint NOT NULL,
	"operation_id" text NOT NULL
);


CREATE TABLE IF NOT EXISTS "tz_bindings" (
	"member_id" text PRIMARY KEY NOT NULL,
	"source_user_id" text NOT NULL,
	"username" text NOT NULL,
	"device_id" text NOT NULL,
	"encrypted_token" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"verified_at" bigint NOT NULL
);
ALTER TABLE "tz_bindings" ADD COLUMN IF NOT EXISTS "game_url" text;
CREATE TABLE IF NOT EXISTS "hr_connections" (
	"member_id" text PRIMARY KEY NOT NULL,
	"binding_version" bigint NOT NULL,
	"encrypted_session" text,
	"snapshot" text,
	"fetched_at" bigint,
	"last_error" text,
	"error_code" text,
	"busy_until" bigint DEFAULT 0 NOT NULL,
	"operation_id" text NOT NULL,
	FOREIGN KEY ("member_id") REFERENCES "tz_bindings"("member_id") ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS "arena_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"expires_at" bigint NOT NULL,
	FOREIGN KEY ("member_id") REFERENCES "tz_bindings"("member_id") ON UPDATE no action ON DELETE cascade
);


CREATE INDEX IF NOT EXISTS "arena_sessions_member" ON "arena_sessions" ("member_id");

CREATE INDEX IF NOT EXISTS "arena_sessions_expiry" ON "arena_sessions" ("expires_at");
CREATE TABLE IF NOT EXISTS "account_access" (
	"member_id" text PRIMARY KEY NOT NULL,
	"enabled" bigint DEFAULT 1 NOT NULL,
	"expires_at" bigint,
	"updated_at" bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS "turnstile_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"encrypted_secret" text NOT NULL,
	"enabled" bigint DEFAULT 0 NOT NULL,
	"updated_at" bigint NOT NULL
);
ALTER TABLE "turnstile_settings" ADD COLUMN IF NOT EXISTS "site_key" text;
CREATE TABLE IF NOT EXISTS "baseball_current" (
	"key" text PRIMARY KEY NOT NULL,
	"league" text NOT NULL,
	"date" text NOT NULL,
	"fetched_at" text NOT NULL,
	"status" text NOT NULL,
	"payload" text NOT NULL
);


CREATE INDEX IF NOT EXISTS "baseball_current_league_date" ON "baseball_current" ("league","date");
CREATE TABLE IF NOT EXISTS "baseball_research" (
	"key" text PRIMARY KEY NOT NULL,
	"league" text NOT NULL,
	"section" text NOT NULL,
	"entity" text NOT NULL,
	"observed_at" text NOT NULL,
	"source_as_of" text,
	"source_url" text NOT NULL,
	"content_hash" text NOT NULL,
	"payload" text NOT NULL,
	"imported_at" text NOT NULL,
	"batch_id" text NOT NULL
);


CREATE INDEX IF NOT EXISTS "baseball_research_section_league" ON "baseball_research" ("section","league");
CREATE TABLE IF NOT EXISTS "baseball_pregame" (
	"key" text PRIMARY KEY NOT NULL,
	"league" text NOT NULL,
	"date" text NOT NULL,
	"observed_at" text NOT NULL,
	"payload" text NOT NULL
);


CREATE INDEX IF NOT EXISTS "baseball_pregame_league_date" ON "baseball_pregame" ("league","date");
CREATE TABLE IF NOT EXISTS "baseball_log_snapshots" (
	"key" text PRIMARY KEY NOT NULL,
	"league" text NOT NULL,
	"season" bigint NOT NULL,
	"observed_at" text NOT NULL,
	"payload" text NOT NULL
);
CREATE TABLE IF NOT EXISTS "international_forecasts" (
	"id" text PRIMARY KEY NOT NULL,
	"league" text NOT NULL,
	"fixture_key" text NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"captured_at" text NOT NULL,
	"version" text NOT NULL,
	"payload" text NOT NULL
);


CREATE INDEX IF NOT EXISTS "international_forecast_fixture_version" ON "international_forecasts" ("fixture_key","version","captured_at");

CREATE INDEX IF NOT EXISTS "international_forecast_start" ON "international_forecasts" ("start_time");

-- Public football predictions only; no member/account/bet data is recorded.
CREATE TABLE IF NOT EXISTS "football_forecasts" (
  "id" text PRIMARY KEY NOT NULL,
  "league" text NOT NULL,
  "game_id" text NOT NULL,
  "start_time" text NOT NULL,
  "captured_at" text NOT NULL,
  "version" text NOT NULL,
  "payload" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "football_forecast_game" ON "football_forecasts" ("league","game_id","start_time");
CREATE TABLE IF NOT EXISTS "football_results" (
  "id" text PRIMARY KEY NOT NULL,
  "league" text NOT NULL,
  "game_id" text NOT NULL,
  "start_time" text NOT NULL,
  "home_goals" bigint NOT NULL,
  "away_goals" bigint NOT NULL,
  "fetched_at" text NOT NULL
);
