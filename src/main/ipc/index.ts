import { ipcMain, dialog } from 'electron'
import { parse as parseCsv } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import * as turf from '@turf/turf'
import { getSheetNames, readSpreadsheet } from '../importers'
import { normaliseRows } from '../importers/normalise'
import { matchLocation, invalidateLocationCache, confirmLocationMatch } from '../locations/match'
import { getDb, getSqlite, reserveLbcSequence } from '../db'
import { sightings, importBatches, locations, species as speciesTable } from '../db/schema'
import { FieldMapping, RawRow } from '../importers/types'
import { BatchOptions } from '../../shared/types'
import { eq } from 'drizzle-orm'
import { matchSpecies, invalidateSpeciesCache } from '../species/match'
import type { ParsedSighting } from '../../shared/types'

type ValidateResult =
  | { status: 'ok'; rows: ParsedSighting[]; warnings: string[] }
  | { status: 'validation-failed'; headers: string[]; allRows: RawRow[]; failures: { index: number; reason: string }[] }

function validateAndMatch(
  rows: RawRow[],
  mapping: FieldMapping,
  headers: string[],
  batchOptions: BatchOptions = {},
): ValidateResult {
  const { rows: parsed, warnings, failures } = normaliseRows(rows, mapping, batchOptions)

  if (failures.length > 0) {
    return { status: 'validation-failed', headers, allRows: rows, failures }
  }

  for (const s of parsed) {
    const match = matchSpecies(s.originalCommonName, s.originalScientificName)
    s.speciesMatchQuality = match.quality
    if (match.quality !== 'none') {
      s.commonName = match.commonName
      s.scientificName = match.scientificName
      if (match.family) s.family = match.family
    }
  }

  for (const s of parsed) {
    const locMatch = matchLocation(s.locationName, s.lat, s.lon)
    s.locationMatchQuality = locMatch.quality
    if (locMatch.locationId != null) s.locationId = locMatch.locationId
    s.locationMatchName = locMatch.matchName
    if (locMatch.candidates.length > 0) s.locationCandidates = locMatch.candidates
  }

  return { status: 'ok', rows: parsed, warnings }
}

async function commitParsed(
  rows: ParsedSighting[],
  filename: string,
  format: string,
  mapping: Partial<FieldMapping>,
): Promise<{ imported: number }> {
  const lbcSeqStart = reserveLbcSequence(rows.length)
  rows.forEach((s, i) => {
    s.lbcId = `LBC#${s.date.substring(0, 4)}#${lbcSeqStart + i}`
  })

  const db = getDb()
  db.transaction((tx) => {
    const [batch] = tx.insert(importBatches).values({
      filename,
      format,
      importedAt: new Date().toISOString(),
      rowCount: rows.length,
      fieldMapping: JSON.stringify(mapping),
    }).returning().all()

    for (let i = 0; i < rows.length; i++) {
      const s = rows[i]
      tx.insert(sightings).values({
        importBatchId:          batch.id,
        locationId:             s.locationId ?? null,
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
        rawData:                s.rawData,
      }).run()
    }
  })

  return { imported: rows.length }
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
    'import:validate',
    async (_e: Electron.IpcMainInvokeEvent, filePath: string, mapping: FieldMapping, sheetName?: string, skipRows = 0, batchOptions?: BatchOptions) => {
      const { headers, rows } = readSpreadsheet(filePath, sheetName, skipRows)
      return validateAndMatch(rows, mapping, headers, batchOptions)
    }
  )

  ipcMain.handle(
    'import:validate-rows',
    async (_e: Electron.IpcMainInvokeEvent, rows: RawRow[], mapping: FieldMapping, batchOptions?: BatchOptions) => {
      const headers = rows.length > 0 ? Object.keys(rows[0]) : []
      return validateAndMatch(rows, mapping, headers, batchOptions)
    }
  )

  ipcMain.handle(
    'import:commit-staged',
    async (_e: Electron.IpcMainInvokeEvent, rows: ParsedSighting[], filename: string, format: string, mapping: Partial<FieldMapping>) => {
      return commitParsed(rows, filename, format, mapping)
    }
  )

  ipcMain.handle('sightings:list', async () => {
    const db = getDb()
    return db.select().from(sightings)
  })

  ipcMain.handle('locations:list', async () => {
    const db = getDb()
    return db.select({
      id: locations.id,
      name: locations.name,
      gridRef: locations.gridRef,
      lat: locations.lat,
      lon: locations.lon,
      centroidLat: locations.centroidLat,
      centroidLon: locations.centroidLon,
      country: locations.country,
      region: locations.region,
      notes: locations.notes,
    }).from(locations)
  })

  ipcMain.handle('locations:list-geometries', () => {
    return getSqlite()
      .prepare('SELECT id, geometry FROM locations WHERE geometry IS NOT NULL')
      .all() as { id: number; geometry: string }[]
  })

  ipcMain.handle('locations:upsert', async (_e: Electron.IpcMainInvokeEvent, data: typeof locations.$inferInsert) => {
    const db = getDb()
    if (data.id) {
      await db.update(locations).set(data)
    } else {
      await db.insert(locations).values(data)
    }
    invalidateLocationCache()
  })

  ipcMain.handle('locations:open-geojson-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'GeoJSON', extensions: ['geojson', 'json'] }],
      properties: ['openFile']
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  ipcMain.handle('locations:import-geojson', async (_e: Electron.IpcMainInvokeEvent, filePath: string) => {
    const errors: string[] = []
    let imported = 0
    try {
      const content = readFileSync(filePath, 'utf-8')
      const geojson = JSON.parse(content)
      const db = getSqlite()
      for (const feature of geojson.features ?? []) {
        const name = feature.properties?.Name
        if (!name) { errors.push('Feature missing Name property'); continue }
        try {
          const centroidPt = turf.centroid(feature)
          const [cLon, cLat] = centroidPt.geometry.coordinates
          db.prepare(
            `INSERT INTO locations(name, centroid_lat, centroid_lon, geometry)
             VALUES(?, ?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET
               centroid_lat=excluded.centroid_lat,
               centroid_lon=excluded.centroid_lon,
               geometry=excluded.geometry`
          ).run(name, cLat, cLon, JSON.stringify(feature.geometry))
          imported++
        } catch (err) {
          errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      if (imported > 0) invalidateLocationCache()
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
    return { imported, errors }
  })

  ipcMain.handle('locations:open-regex-csv-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile']
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  ipcMain.handle('locations:import-regex-csv', async (_e: Electron.IpcMainInvokeEvent, filePath: string) => {
    const errors: string[] = []
    let imported = 0
    try {
      const content = readFileSync(filePath, 'utf-8')
      const records = parseCsv(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[]
      const db = getSqlite()
      db.prepare('DELETE FROM location_regex').run()
      for (const [idx, rec] of records.entries()) {
        const siteName = rec.siteName?.trim()
        const regex = rec.regex?.trim()
        const matchName = rec.matchName?.trim()
        if (!siteName || !regex) { errors.push(`Row ${idx + 2}: missing siteName or regex`); continue }
        try {
          new RegExp(regex)
          db.prepare('INSERT INTO location_regex(site_name, regex, match_name) VALUES(?, ?, ?)').run(siteName, regex, matchName || null)
          imported++
        } catch (err) {
          errors.push(`Row ${idx + 2}: invalid regex — ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      if (imported > 0) invalidateLocationCache()
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
    return { imported, errors }
  })

  ipcMain.handle('locations:confirm-match', (_e: Electron.IpcMainInvokeEvent, rawString: string, locationId: number) => {
    confirmLocationMatch(rawString, locationId)
  })

  ipcMain.handle('locations:get', (_e: Electron.IpcMainInvokeEvent, id: number) => {
    return getSqlite().prepare('SELECT * FROM locations WHERE id = ?').get(id)
  })

  ipcMain.handle('locations:list-regex', (_e: Electron.IpcMainInvokeEvent, siteName: string) => {
    return getSqlite().prepare('SELECT id, site_name as siteName, regex, match_name as matchName FROM location_regex WHERE site_name = ? ORDER BY id').all(siteName)
  })

  ipcMain.handle('locations:save-regex', (_e: Electron.IpcMainInvokeEvent, siteName: string, rows: { regex: string; matchName: string }[]) => {
    const db = getSqlite()
    db.prepare('DELETE FROM location_regex WHERE site_name = ?').run(siteName)
    const insert = db.prepare('INSERT INTO location_regex(site_name, regex, match_name) VALUES(?, ?, ?)')
    for (const row of rows) {
      if (row.regex.trim()) insert.run(siteName, row.regex.trim(), row.matchName.trim() || null)
    }
    invalidateLocationCache()
  })

  // Species handlers
  ipcMain.handle('species:list', async () => {
    const db = getDb()
    return db.select().from(speciesTable).orderBy(speciesTable.commonName)
  })

  ipcMain.handle('species:upsert', async (_e: Electron.IpcMainInvokeEvent, record: typeof speciesTable.$inferInsert) => {
    const db = getDb()
    if (record.id) {
      await db.update(speciesTable).set(record).where(eq(speciesTable.id, record.id))
    } else {
      await db.insert(speciesTable).values(record)
    }
    invalidateSpeciesCache()
  })

  ipcMain.handle('species:open-csv-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile']
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  ipcMain.handle('species:import-csv', async (_e: Electron.IpcMainInvokeEvent, filePath: string) => {
    const errors: string[] = []
    let imported = 0
    try {
      const content = readFileSync(filePath, 'utf-8')
      const records = parseCsv(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[]
      const db = getDb()
      for (const [idx, rec] of records.entries()) {
        const commonName = rec.common_name?.trim()
        const scientificName = rec.scientific_name?.trim()
        if (!commonName || !scientificName) {
          errors.push(`Row ${idx + 2}: missing common_name or scientific_name`)
          continue
        }
        await db.insert(speciesTable).values({
          commonName,
          commonNameRegex: rec.common_name_regex?.trim() || null,
          scientificName,
          scientificNameRegex: rec.scientific_name_regex?.trim() || null,
          family: rec.family?.trim() || null,
        })
        imported++
      }
      if (imported > 0) invalidateSpeciesCache()
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
    return { imported, errors }
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
