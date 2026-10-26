PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fcm_token TEXT NOT NULL UNIQUE,
  auth_hash TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  app_version TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS device_subscriptions (
  device_id TEXT NOT NULL,
  category TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (device_id, category),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pairings (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  suggested_name TEXT NOT NULL DEFAULT '',
  subscriptions_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pairings_code ON pairings(code_hash, expires_at);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  sticky INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  sent_at TEXT,
  last_error TEXT,
  UNIQUE(alert_id, device_id, revision, action),
  FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deliveries_due ON deliveries(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS acknowledgements (
  alert_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  action TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  PRIMARY KEY(alert_id, device_id, action),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS monitor_state (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
