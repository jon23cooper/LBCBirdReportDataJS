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
  species TEXT NOT NULL,
  common_name TEXT,
  scientific_name TEXT,
  "order" TEXT,
  family TEXT,
  date TEXT NOT NULL,
  time TEXT,
  count INTEGER,
  count_approx INTEGER,
  sex TEXT,
  age TEXT,
  breeding TEXT,
  ring TEXT,
  notes TEXT,
  observer TEXT,
  source_ref TEXT,
  lat REAL,
  lon REAL,
  raw_data TEXT
);
`

export function initDb(): void {
  const dbPath = join(app.getPath('userData'), 'birdreport.db')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(SCHEMA_SQL)
  _db = drizzle(sqlite, { schema })
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) throw new Error('Database not initialised')
  return _db
}
