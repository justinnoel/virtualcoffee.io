-- D1 schema for the 4 public forms (ported off Airtable).
-- Nullability mirrors each form's required/optional fields.
-- created_at uses SQLite's datetime('now') (UTC ISO-8601, second precision).

CREATE TABLE IF NOT EXISTS lunch_and_learn_ideas (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT NOT NULL,
  format TEXT,
  timing TEXT NOT NULL
);

-- name + email nullable so anonymous reports are preserved as-is.
CREATE TABLE IF NOT EXISTS coc_violation_reports (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT,
  email TEXT,
  reportee_name TEXT NOT NULL,
  time_location TEXT NOT NULL,
  description TEXT NOT NULL,
  anyone_else_involved TEXT
);

CREATE TABLE IF NOT EXISTS coffee_table_groups (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  group_name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS volunteer_submissions (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  github_username TEXT NOT NULL,
  position TEXT NOT NULL,
  description TEXT NOT NULL
);
