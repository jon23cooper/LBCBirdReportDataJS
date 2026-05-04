import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _sqlite: InstanceType<typeof Database> | null = null

export function reserveLbcSequence(count: number): number {
  if (!_sqlite) throw new Error('Database not initialised')
  const row = _sqlite.prepare("SELECT value FROM settings WHERE key='lbc_sequence'").get() as { value: string } | undefined
  const current = row ? parseInt(row.value) : 0
  const next = current + count
  _sqlite.prepare("INSERT INTO settings(key,value) VALUES('lbc_sequence',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(next))
  return current + 1
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  grid_ref TEXT,
  lat REAL,
  lon REAL,
  country TEXT,
  region TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  format TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  row_count INTEGER,
  field_mapping TEXT
);

CREATE TABLE IF NOT EXISTS sightings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_batch_id INTEGER REFERENCES import_batches(id),
  location_id INTEGER REFERENCES locations(id),
  original_location TEXT,
  occurrence_key TEXT,
  dataset TEXT,
  lbc_id TEXT,
  species TEXT NOT NULL,
  original_common_name TEXT,
  common_name TEXT,
  original_scientific_name TEXT,
  scientific_name TEXT,
  family TEXT,
  subspecies_common TEXT,
  subspecies_scientific TEXT,
  date TEXT NOT NULL,
  last_date TEXT,
  time TEXT,
  end_time TEXT,
  count INTEGER,
  original_count TEXT,
  circa TEXT,
  age TEXT,
  status TEXT,
  breeding_code TEXT,
  breeding_category TEXT,
  behavior_code TEXT,
  observer TEXT,
  notes TEXT,
  lat REAL,
  lon REAL,
  uncertainty_radius REAL,
  geometry_type TEXT,
  trip_map_ref TEXT,
  source_ref TEXT,
  raw_data TEXT
);
`

// Columns added after initial release — safe to ignore "duplicate column" errors
const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS species (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    common_name TEXT NOT NULL,
    common_name_regex TEXT,
    scientific_name TEXT NOT NULL,
    scientific_name_regex TEXT,
    family TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  'ALTER TABLE sightings ADD COLUMN original_common_name TEXT',
  'ALTER TABLE sightings ADD COLUMN original_scientific_name TEXT',
  'ALTER TABLE sightings ADD COLUMN original_location TEXT',
  'ALTER TABLE sightings ADD COLUMN occurrence_key TEXT',
  'ALTER TABLE sightings ADD COLUMN dataset TEXT',
  'ALTER TABLE sightings ADD COLUMN lbc_id TEXT',
  'ALTER TABLE sightings ADD COLUMN subspecies_common TEXT',
  'ALTER TABLE sightings ADD COLUMN subspecies_scientific TEXT',
  'ALTER TABLE sightings ADD COLUMN last_date TEXT',
  'ALTER TABLE sightings ADD COLUMN end_time TEXT',
  'ALTER TABLE sightings ADD COLUMN original_count TEXT',
  'ALTER TABLE sightings ADD COLUMN circa TEXT',
  'ALTER TABLE sightings ADD COLUMN status TEXT',
  'ALTER TABLE sightings ADD COLUMN breeding_code TEXT',
  'ALTER TABLE sightings ADD COLUMN breeding_category TEXT',
  'ALTER TABLE sightings ADD COLUMN behavior_code TEXT',
  'ALTER TABLE sightings ADD COLUMN uncertainty_radius REAL',
  'ALTER TABLE sightings ADD COLUMN geometry_type TEXT',
  'ALTER TABLE sightings ADD COLUMN trip_map_ref TEXT',
  'ALTER TABLE locations ADD COLUMN centroid_lat REAL',
  'ALTER TABLE locations ADD COLUMN centroid_lon REAL',
  'ALTER TABLE locations ADD COLUMN geometry TEXT',
  `CREATE TABLE IF NOT EXISTS location_regex (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_name TEXT NOT NULL,
    regex TEXT NOT NULL,
    match_name TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS location_match_cache (
    raw_string TEXT PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    confirmed_at TEXT NOT NULL
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS locations_name_unique ON locations(name)',
  'ALTER TABLE import_batches ADD COLUMN stored_file TEXT',
  // Sync-related columns
  'ALTER TABLE import_batches ADD COLUMN pushed_at TEXT',
  'ALTER TABLE sightings ADD COLUMN created_at TEXT',
  'ALTER TABLE sightings ADD COLUMN updated_at TEXT',
]

export function initDb(): void {
  const dbPath = join(app.getPath('userData'), 'birdreport.db')
  _sqlite = new Database(dbPath)
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('foreign_keys = ON')
  _sqlite.exec(SCHEMA_SQL)
  for (const sql of MIGRATIONS) {
    try { _sqlite.exec(sql) } catch { /* column already exists */ }
  }
  _db = drizzle(_sqlite, { schema })
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) throw new Error('Database not initialised')
  return _db
}

export function getSqlite(): InstanceType<typeof Database> {
  if (!_sqlite) throw new Error('Database not initialised')
  return _sqlite
}
