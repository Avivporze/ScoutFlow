-- ============================================================
-- Migration 002: Add FBref URL and player stats columns
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS fbref_url         text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_matches     integer NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_goals       integer NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_assists     integer NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_minutes     integer NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS stats_updated_at  timestamptz;
