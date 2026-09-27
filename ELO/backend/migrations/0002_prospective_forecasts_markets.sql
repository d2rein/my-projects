-- Append-only operational evidence used by the 2027 preview.
-- These tables never alter Elo parameters or match results.
ALTER TABLE prospective_team_list_snapshots ADD COLUMN lineup_kind TEXT NOT NULL DEFAULT 'announced';

CREATE TABLE IF NOT EXISTS prospective_forecast_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nrl_match_id TEXT NOT NULL,
  season INTEGER NOT NULL,
  round_name TEXT NOT NULL DEFAULT '',
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  model TEXT NOT NULL,
  generated_at_utc TEXT NOT NULL,
  source_observed_at_utc TEXT NOT NULL DEFAULT '',
  lineup_sha256 TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL,
  captured_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (nrl_match_id, model, lineup_sha256, source_observed_at_utc)
);

CREATE INDEX IF NOT EXISTS idx_prospective_forecasts_latest
  ON prospective_forecast_snapshots (season, nrl_match_id, id DESC);

CREATE TABLE IF NOT EXISTS prospective_market_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observation_sha256 TEXT NOT NULL UNIQUE,
  season INTEGER NOT NULL,
  competition TEXT NOT NULL,
  observed_at_utc TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  bookmaker TEXT NOT NULL DEFAULT '',
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff_utc TEXT NOT NULL DEFAULT '',
  market_type TEXT NOT NULL,
  selection_name TEXT NOT NULL,
  line REAL,
  decimal_odds REAL NOT NULL,
  payload_json TEXT NOT NULL,
  captured_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_prospective_markets_event
  ON prospective_market_observations (season, competition, home_team, away_team, observed_at_utc);
