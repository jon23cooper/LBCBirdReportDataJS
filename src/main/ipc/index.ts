import { ipcMain, dialog } from 'electron'
import { getSheetNames, readSpreadsheet } from '../importers'
import { normaliseRows } from '../importers/normalise'
import { resolveLocationId } from '../locations/match'
import { getDb } from '../db'
import { sightings, importBatches, locations } from '../db/schema'
import { FieldMapping, RawRow } from '../importers/types'
import { basename, extname } from 'path'

async function validateAndInsert(
  rows: RawRow[],
  mapping: FieldMapping,
  headers: string[],
  filename: string,
  format: string
) {
  const { rows: parsed, warnings, failures } = normaliseRows(rows, mapping)

  if (failures.length > 0) {
    return { status: 'validation-failed' as const, headers, allRows: rows, failures }
  }

  const locationIds = await Promise.all(
    parsed.map(s => resolveLocationId(s.locationName, s.lat, s.lon))
  )

  const db = getDb()
  await db.transaction(async (tx) => {
    const [batch] = await tx.insert(importBatches).values({
      filename,
      format,
      importedAt: new Date().toISOString(),
      rowCount: parsed.length,
      fieldMapping: JSON.stringify(mapping)
    }).returning()

    for (let i = 0; i < parsed.length; i++) {
      const s = parsed[i]
      await tx.insert(sightings).values({
        importBatchId:          batch.id,
        locationId:             locationIds[i],
        originalLocation:       s.originalLocation,
        occurrenceKey:          s.occurrenceKey,
        dataset:                s.dataset,
        lbcId:                  s.lbcId,
        species:                s.species,
        originalCommonName:     s.originalCommonName,
        commonName:             s.commonName,
        originalScientificName: s.originalScientificName,
        scientificName:         s.scientificName,
        family:                 s.family,
        subspeciesCommon:       s.subspeciesCommon,
        subspeciesScientific:   s.subspeciesScientific,
        date:                   s.date,
        lastDate:               s.lastDate,
        time:                   s.time,
        endTime:                s.endTime,
        count:                  s.count,
        originalCount:          s.originalCount,
        circa:                  s.circa,
        age:                    s.age,
        status:                 s.status,
        breedingCode:           s.breedingCode,
        breedingCategory:       s.breedingCategory,
        behaviorCode:           s.behaviorCode,
        observer:               s.observer,
        notes:                  s.notes,
        lat:                    s.lat,
        lon:                    s.lon,
        uncertaintyRadius:      s.uncertaintyRadius,
        geometryType:           s.geometryType,
        tripMapRef:             s.tripMapRef,
        rawData:                s.rawData
      })
    }
  })

  return { status: 'success' as const, imported: parsed.length, warnings }
}

export function registerIpcHandlers(): void {
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

  ipcMain.handle('import:read-sheet', async (_e: Electron.IpcMainInvokeEvent, filePath: string, sheetName: string, skipRows: number) => {
    const { headers, rows } = readSpreadsheet(filePath, sheetName, skipRows)
    return { headers, preview: rows.slice(0, 5) }
  })

  ipcMain.handle(
    'import:commit',
    async (_e: Electron.IpcMainInvokeEvent, filePath: string, mapping: FieldMapping, sheetName?: string, skipRows = 0) => {
      const { headers, rows } = readSpreadsheet(filePath, sheetName, skipRows)
      return validateAndInsert(rows, mapping, headers, basename(filePath), extname(filePath).replace('.', ''))
    }
  )

  ipcMain.handle(
    'import:commit-rows',
    async (_e: Electron.IpcMainInvokeEvent, rows: RawRow[], mapping: FieldMapping, filename: string) => {
      const headers = rows.length > 0 ? Object.keys(rows[0]) : []
      return validateAndInsert(rows, mapping, headers, filename, 'edited')
    }
  )

  ipcMain.handle('sightings:list', async () => {
    const db = getDb()
    return db.select().from(sightings)
  })

  ipcMain.handle('locations:list', async () => {
    const db = getDb()
    return db.select().from(locations)
  })

  ipcMain.handle('locations:upsert', async (_e: Electron.IpcMainInvokeEvent, data: typeof locations.$inferInsert) => {
    const db = getDb()
    if (data.id) {
      await db.update(locations).set(data)
    } else {
      await db.insert(locations).values(data)
    }
  })

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
  date DATE NOT NULL,
  last_date DATE,
  time TIME,
  end_time TIME,
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
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  uncertainty_radius DOUBLE PRECISION,
  geometry_type TEXT,
  trip_map_ref TEXT,
  source_ref TEXT,
  raw_data TEXT
);`
}

function locationToInsert(l: typeof locations.$inferSelect): string {
  return `INSERT INTO locations (id, name, grid_ref, lat, lon, country, region, notes) VALUES (${q(l.id)}, ${q(l.name)}, ${q(l.gridRef)}, ${q(l.lat)}, ${q(l.lon)}, ${q(l.country)}, ${q(l.region)}, ${q(l.notes)});`
}

function sightingToInsert(s: typeof sightings.$inferSelect): string {
  const cols = 'id, import_batch_id, location_id, original_location, occurrence_key, dataset, lbc_id, species, original_common_name, common_name, original_scientific_name, scientific_name, family, subspecies_common, subspecies_scientific, date, last_date, time, end_time, count, original_count, circa, age, status, breeding_code, breeding_category, behavior_code, observer, notes, lat, lon, uncertainty_radius, geometry_type, trip_map_ref, source_ref, raw_data'
  const vals = [
    q(s.id), q(s.importBatchId), q(s.locationId),
    q(s.originalLocation), q(s.occurrenceKey), q(s.dataset), q(s.lbcId),
    q(s.species), q(s.originalCommonName), q(s.commonName), q(s.originalScientificName), q(s.scientificName),
    q(s.family), q(s.subspeciesCommon), q(s.subspeciesScientific),
    q(s.date), q(s.lastDate), q(s.time), q(s.endTime),
    q(s.count), q(s.originalCount), q(s.circa),
    q(s.age), q(s.status),
    q(s.breedingCode), q(s.breedingCategory), q(s.behaviorCode),
    q(s.observer), q(s.notes),
    q(s.lat), q(s.lon), q(s.uncertaintyRadius), q(s.geometryType), q(s.tripMapRef),
    q(s.sourceRef), q(s.rawData)
  ].join(', ')
  return `INSERT INTO sightings (${cols}) VALUES (${vals});`
}
