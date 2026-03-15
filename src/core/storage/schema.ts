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
  `CREATE TABLE IF NOT EXISTS stay_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stay_id INTEGER NOT NULL,
    asset_id TEXT NOT NULL,
    uri TEXT NOT NULL,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    taken_at INTEGER NOT NULL,
    FOREIGN KEY (stay_id) REFERENCES stays(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_stay_id INTEGER NOT NULL,
    to_stay_id INTEGER NOT NULL,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    distance_m INTEGER NOT NULL DEFAULT 0,
    duration_min INTEGER NOT NULL DEFAULT 0,
    avg_speed_kmh REAL NOT NULL DEFAULT 0,
    mode TEXT NOT NULL DEFAULT 'unknown',
    user_mode TEXT,
    FOREIGN KEY (from_stay_id) REFERENCES stays(id) ON DELETE CASCADE,
    FOREIGN KEY (to_stay_id) REFERENCES stays(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_raw_events_ts ON raw_events(ts)`,
  `CREATE INDEX IF NOT EXISTS idx_stays_start ON stays(start_ts)`,
  `CREATE INDEX IF NOT EXISTS idx_stay_photos_stay ON stay_photos(stay_id)`,
  `CREATE INDEX IF NOT EXISTS idx_diary_day ON diary_entries(day_key)`,
  `CREATE INDEX IF NOT EXISTS idx_movements_from ON movements(from_stay_id)`,
  `CREATE INDEX IF NOT EXISTS idx_movements_to ON movements(to_stay_id)`,
  `ALTER TABLE stays ADD COLUMN IF NOT EXISTS memo TEXT`,
] as const;
