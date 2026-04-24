import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

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
]

export function initDb(): void {
  const dbPath = join(app.getPath('userData'), 'birdreport.db')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(SCHEMA_SQL)
  for (const sql of MIGRATIONS) {
    try { sqlite.exec(sql) } catch { /* column already exists */ }
  }
  _db = drizzle(sqlite, { schema })
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) throw new Error('Database not initialised')
  return _db
}
