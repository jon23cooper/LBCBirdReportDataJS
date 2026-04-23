import { ipcMain, dialog } from 'electron'
import { getSheetNames, readSpreadsheet } from '../importers'
import { normaliseRows } from '../importers/normalise'
import { resolveLocationId } from '../locations/match'
import { getDb } from '../db'
import { sightings, importBatches, locations } from '../db/schema'
import { FieldMapping } from '../importers/types'
import { basename } from 'path'
import { extname } from 'path'

export function registerIpcHandlers(): void {
  // Open file picker and return parsed headers + preview rows
  ipcMain.handle('import:open-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Spreadsheets', extensions: ['csv', 'xlsx', 'xls', 'ods'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    const filePath = filePaths[0]
    const sheets = getSheetNames(filePath)
    const { headers, rows } = readSpreadsheet(filePath)
    return { path: filePath, sheets, headers, preview: rows.slice(0, 5) }
  })

  // Return headers + preview for a specific sheet/skipRows without opening a dialog
  ipcMain.handle('import:read-sheet', async (_e: Electron.IpcMainInvokeEvent, filePath: string, sheetName: string, skipRows: number) => {
    const { headers, rows } = readSpreadsheet(filePath, sheetName, skipRows)
    return { headers, preview: rows.slice(0, 5) }
  })

  // Confirm field mapping and import rows into DB
  ipcMain.handle(
    'import:commit',
    async (_e: Electron.IpcMainInvokeEvent, filePath: string, mapping: FieldMapping, sheetName?: string, skipRows = 0) => {
      const { rows } = readSpreadsheet(filePath, sheetName, skipRows)
      const { rows: parsed, warnings } = normaliseRows(rows, mapping)

      const db = getDb()
      const now = new Date().toISOString()
      const ext = extname(filePath).replace('.', '')

      const [batch] = await db
        .insert(importBatches)
        .values({
          filename: basename(filePath),
          format: ext,
          importedAt: now,
          rowCount: parsed.length,
          fieldMapping: JSON.stringify(mapping)
        })
        .returning()

      for (const s of parsed) {
        const locationId = await resolveLocationId(s.locationName, s.lat, s.lon)
        await db.insert(sightings).values({
          importBatchId: batch.id,
          locationId,
          species: s.species,
          date: s.date,
          time: s.time,
          count: s.count,
          observer: s.observer,
          notes: s.notes,
          lat: s.lat,
          lon: s.lon,
          rawData: s.rawData
        })
      }

      return { imported: parsed.length, warnings }
    }
  )

  // Return all sightings with joined location name
  ipcMain.handle('sightings:list', async () => {
    const db = getDb()
    return db.select().from(sightings)
  })

  // Return all locations
  ipcMain.handle('locations:list', async () => {
    const db = getDb()
    return db.select().from(locations)
  })

  // Add / update a location
  ipcMain.handle('locations:upsert', async (_e: Electron.IpcMainInvokeEvent, data: typeof locations.$inferInsert) => {
    const db = getDb()
    if (data.id) {
      await db.update(locations).set(data)
    } else {
      await db.insert(locations).values(data)
    }
  })

  // Export to SQL (Postgres-compatible)
  ipcMain.handle('export:sql', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: 'birdreport.sql',
      filters: [{ name: 'SQL', extensions: ['sql'] }]
    })
    if (canceled || !filePath) return null

    const db = getDb()
    const allSightings = await db.select().from(sightings)
    const allLocations = await db.select().from(locations)

    const lines: string[] = [
      '-- LBC Bird Report export',
      `-- Generated: ${new Date().toISOString()}`,
      '',
      buildCreateLocations(),
      buildCreateSightings(),
      '',
      ...allLocations.map(locationToInsert),
      ...allSightings.map(sightingToInsert)
    ]

    const { writeFileSync } = await import('fs')
    writeFileSync(filePath, lines.join('\n'))
    return filePath
  })
}

function q(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  return `'${String(v).replace(/'/g, "''")}'`
}

function buildCreateLocations(): string {
  return `CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  grid_ref TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  country TEXT,
  region TEXT,
  notes TEXT
);`
}

function buildCreateSightings(): string {
  return `CREATE TABLE IF NOT EXISTS sightings (
  id SERIAL PRIMARY KEY,
  import_batch_id INTEGER,
  location_id INTEGER REFERENCES locations(id),
  species TEXT NOT NULL,
  common_name TEXT,
  scientific_name TEXT,
  date DATE NOT NULL,
  time TIME,
  count INTEGER,
  count_approx INTEGER,
  sex TEXT,
  age TEXT,
  breeding TEXT,
  ring TEXT,
  observer TEXT,
  notes TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  source_ref TEXT,
  raw_data TEXT
);`
}

function locationToInsert(l: typeof locations.$inferSelect): string {
  return `INSERT INTO locations (id, name, grid_ref, lat, lon, country, region, notes) VALUES (${q(l.id)}, ${q(l.name)}, ${q(l.gridRef)}, ${q(l.lat)}, ${q(l.lon)}, ${q(l.country)}, ${q(l.region)}, ${q(l.notes)});`
}

function sightingToInsert(s: typeof sightings.$inferSelect): string {
  return `INSERT INTO sightings (id, import_batch_id, location_id, species, common_name, scientific_name, date, time, count, count_approx, sex, age, breeding, ring, observer, notes, lat, lon, source_ref, raw_data) VALUES (${q(s.id)}, ${q(s.importBatchId)}, ${q(s.locationId)}, ${q(s.species)}, ${q(s.commonName)}, ${q(s.scientificName)}, ${q(s.date)}, ${q(s.time)}, ${q(s.count)}, ${q(s.countApprox)}, ${q(s.sex)}, ${q(s.age)}, ${q(s.breeding)}, ${q(s.ring)}, ${q(s.observer)}, ${q(s.notes)}, ${q(s.lat)}, ${q(s.lon)}, ${q(s.sourceRef)}, ${q(s.rawData)});`
}
