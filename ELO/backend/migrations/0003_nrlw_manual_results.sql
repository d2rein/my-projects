-- Append-only manual NRLW result revisions. RLDB remains read-only.
CREATE TABLE IF NOT EXISTS nrlw_manual_result_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_key TEXT NOT NULL,
  season INTEGER NOT NULL,
  round_name TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  source TEXT NOT NULL DEFAULT 'manual_website_entry',
  entered_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_nrlw_manual_results_latest
  ON nrlw_manual_result_revisions (season, match_key, id DESC);
