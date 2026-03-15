export const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS raw_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    acc REAL NOT NULL,
    source TEXT NOT NULL DEFAULT 'background'
  )`,
  `CREATE TABLE IF NOT EXISTS stays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    radius_m REAL NOT NULL DEFAULT 0,
    place_json TEXT,
    activity TEXT,
    confidence REAL NOT NULL DEFAULT 0,
    needs_review INTEGER NOT NULL DEFAULT 0,
    user_place_name TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS diary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_key TEXT NOT NULL UNIQUE,
    title TEXT,
    body TEXT,
    highlights_json TEXT,
    share_text TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_raw_events_ts ON raw_events(ts)`,
  `CREATE INDEX IF NOT EXISTS idx_stays_start ON stays(start_ts)`,
  `CREATE INDEX IF NOT EXISTS idx_diary_day ON diary_entries(day_key)`,
] as const;
