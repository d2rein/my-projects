-- Append-only official pre-match squad snapshots. This table is deliberately
-- separate from matches, ratings and parameters: collecting a list cannot
-- recalculate or mutate the live Elo model.
CREATE TABLE IF NOT EXISTS prospective_team_list_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nrl_match_id TEXT NOT NULL,
  season INTEGER NOT NULL,
  round_number INTEGER,
  round_name TEXT NOT NULL DEFAULT '',
  kickoff_utc TEXT NOT NULL DEFAULT '',
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  observed_at_utc TEXT NOT NULL,
  source_updated_at_utc TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL,
  lineup_sha256 TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  captured_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (nrl_match_id, lineup_sha256)
);

CREATE INDEX IF NOT EXISTS idx_prospective_team_lists_season_kickoff
  ON prospective_team_list_snapshots (season, kickoff_utc DESC);

CREATE INDEX IF NOT EXISTS idx_prospective_team_lists_match_latest
  ON prospective_team_list_snapshots (nrl_match_id, id DESC);
