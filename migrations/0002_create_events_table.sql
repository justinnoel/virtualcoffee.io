-- D1 schema for events. Replaces the Solspace Calendar / CraftCMS read path.
-- Discrete-occurrence model: one row per event instance. Two sources:
--   - manual  : one-offs entered by hand in the Cloudflare dashboard.
--   - recurring: rows materialized into the future by a daily Cron Trigger
--                from src/data/events/recurring.ts.

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  title TEXT NOT NULL,
  description TEXT,                                   -- HTML; sanitized at read
  start_utc TEXT NOT NULL,                            -- ISO-8601 UTC
  end_utc TEXT NOT NULL,                              -- ISO-8601 UTC
  timezone TEXT NOT NULL DEFAULT 'America/New_York',  -- IANA; drives recurring expansion
  source TEXT NOT NULL DEFAULT 'manual',              -- 'manual' | 'recurring'
  source_id TEXT,                                     -- recurring def slug; NULL for manual
  cancelled INTEGER NOT NULL DEFAULT 0
);

-- Idempotency for the cron: recurring rows dedupe on (slug, instant).
-- SQLite treats NULL source_id as DISTINCT, so manual rows (NULL) never collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source ON events (source_id, start_utc);
CREATE INDEX IF NOT EXISTS idx_events_start ON events (start_utc);
