/**
 * sync/index.ts
 * Handles push (SQLite → Pi Postgres) and sync-back (Pi Postgres → SQLite)
 */

import { getSqlite, reserveLbcSequence } from '../db'

const API_URL = process.env.LBC_API_URL
const API_KEY = process.env.LBC_API_KEY
const CHUNK   = 500

if (!API_URL || !API_KEY) {
  console.warn('[sync] LBC_API_URL or LBC_API_KEY not set — sync will be unavailable')
}

async function apiGet(path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `ApiKey ${API_KEY}` },
  })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `ApiKey ${API_KEY}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
  return res.json()
}

async function apiPut(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `ApiKey ${API_KEY}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`)
  return res.json()
}

async function apiPatch(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `ApiKey ${API_KEY}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`)
  return res.json()
}

function cleanDate(v: unknown): string | null {
  if (!v) return null
  return String(v).slice(0, 10)
}

function cleanTime(v: unknown): string | null {
  if (!v) return null
  return String(v).slice(0, 5)
}

function sightingToApiRow(s: Record<string, unknown>): Record<string, unknown> {
  return {
    lbc_id:                   s.lbc_id,
    occurrence_key:           s.occurrence_key,
    dataset:                  s.dataset,
    species:                  s.species,
    original_common_name:     s.original_common_name,
    common_name:              s.common_name,
    original_scientific_name: s.original_scientific_name,
    scientific_name:          s.scientific_name,
    family:                   s.family,
    subspecies_common:        s.subspecies_common,
    subspecies_scientific:    s.subspecies_scientific,
    original_location:        s.original_location,
    location_name:            s.location_name,
    date:                     s.date,
    last_date:                s.last_date,
    time:                     s.time,
    end_time:                 s.end_time,
    count:                    s.count,
    original_count:           s.original_count,
    circa:                    s.circa,
    age:                      s.age,
    status:                   s.status,
    breeding_code:            s.breeding_code,
    breeding_category:        s.breeding_category,
    behavior_code:            s.behavior_code,
    observer:                 s.observer,
    notes:                    s.notes,
    lat:                      s.lat,
    lon:                      s.lon,
    uncertainty_radius:       s.uncertainty_radius,
    geometry_type:            s.geometry_type,
    trip_map_ref:             s.trip_map_ref,
    source_ref:               s.source_ref,
    created_at:               s.created_at,
    updated_at:               s.updated_at,
  }
}

export async function setLock(locked: boolean): Promise<void> {
  await apiPut('/settings/dataset_locked', { value: locked ? 'true' : 'false' })
}

export async function pushLocations(): Promise<{ pushed: number }> {
  const db = getSqlite()
  const locs = db.prepare('SELECT * FROM locations').all() as Record<string, unknown>[]
  const rows = locs.map(loc => ({
    name: loc.name, grid_ref: loc.grid_ref, lat: loc.lat, lon: loc.lon,
    centroid_lat: loc.centroid_lat, centroid_lon: loc.centroid_lon,
    geometry: loc.geometry, country: loc.country, region: loc.region, notes: loc.notes,
  }))
  const result = await apiPost('/locations/bulk-upsert', { rows })
  return { pushed: result.upserted ?? locs.length }
}

export async function pushSpecies(): Promise<{ pushed: number }> {
  const db = getSqlite()
  const rows = db.prepare('SELECT * FROM species ORDER BY common_name').all() as Record<string, unknown>[]
  for (const row of rows) {
    await apiPost('/species/upsert', {
      common_name: row.common_name, common_name_regex: row.common_name_regex,
      scientific_name: row.scientific_name, scientific_name_regex: row.scientific_name_regex,
      family: row.family,
    })
  }
  return { pushed: rows.length }
}

export async function pushBatch(batchId: number): Promise<{ inserted: number; updated: number }> {
  const db = getSqlite()
  const rows = db.prepare(`
    SELECT s.*, l.name as location_name
    FROM sightings s
    LEFT JOIN locations l ON l.id = s.location_id
    WHERE s.import_batch_id = ?
  `).all(batchId) as Record<string, unknown>[]

  if (rows.length === 0) return { inserted: 0, updated: 0 }

  const apiRows = rows.map(sightingToApiRow)
  let totalInserted = 0, totalUpdated = 0

  for (let i = 0; i < apiRows.length; i += CHUNK) {
    const chunk = apiRows.slice(i, i + CHUNK)
    const result = await apiPost('/sightings/bulk-upsert', { rows: chunk })
    totalInserted += result.inserted ?? 0
    totalUpdated  += result.updated  ?? 0
  }

  db.prepare('UPDATE import_batches SET pushed_at = ? WHERE id = ?')
    .run(new Date().toISOString(), batchId)

  return { inserted: totalInserted, updated: totalUpdated }
}

export async function pushAllUnpushed(): Promise<{ batches: number; inserted: number; updated: number }> {
  const db = getSqlite()
  const unpushed = db.prepare(
    'SELECT id FROM import_batches WHERE pushed_at IS NULL ORDER BY imported_at'
  ).all() as { id: number }[]

  let totalInserted = 0, totalUpdated = 0
  for (const { id } of unpushed) {
    const result = await pushBatch(id)
    totalInserted += result.inserted
    totalUpdated  += result.updated
  }
  return { batches: unpushed.length, inserted: totalInserted, updated: totalUpdated }
}

export async function syncBack(): Promise<{ updated: number; deleted: number; inserted: number; assigned: number }> {
  const db = getSqlite()

  const row = db.prepare("SELECT value FROM settings WHERE key = 'last_sync_at'").get() as { value: string } | undefined
  const since = row?.value ?? '1970-01-01T00:00:00.000Z'

  const changes = await apiGet(`/sightings/changes-since/${encodeURIComponent(since)}`) as Record<string, unknown>[]

  let updated = 0, deleted = 0, inserted = 0, assigned = 0

  for (const change of changes) {
    const lbcId     = change.lbc_id as string | null
    const isDeleted = change.is_deleted as boolean

    if (isDeleted) {
      if (lbcId) {
        db.prepare('DELETE FROM sightings WHERE lbc_id = ?').run(lbcId)
        deleted++
      }
      continue
    }

    if (lbcId) {
      const existing = db.prepare('SELECT id FROM sightings WHERE lbc_id = ?').get(lbcId) as { id: number } | undefined
      if (existing) {
        db.prepare(`
          UPDATE sightings SET
            common_name = ?, scientific_name = ?, family = ?,
            subspecies_common = ?, subspecies_scientific = ?,
            date = ?, last_date = ?, time = ?, end_time = ?,
            count = ?, original_count = ?, circa = ?, age = ?,
            status = ?, breeding_code = ?, breeding_category = ?,
            behavior_code = ?, observer = ?, notes = ?,
            original_location = ?, updated_at = ?
          WHERE lbc_id = ?
        `).run(
          change.common_name, change.scientific_name, change.family,
          change.subspecies_common, change.subspecies_scientific,
          cleanDate(change.date), cleanDate(change.last_date),
          cleanTime(change.time), cleanTime(change.end_time),
          change.count, change.original_count, change.circa, change.age,
          change.status, change.breeding_code, change.breeding_category,
          change.behavior_code, change.observer, change.notes,
          change.original_location, change.updated_at,
          lbcId
        )
        updated++
      }
    } else {
      const date     = cleanDate(change.date)
      const year     = date?.substring(0, 4) || new Date().getFullYear().toString()
      const newLbcId = `LBC#${year}#${reserveLbcSequence(1)}`
      // Web-created records have no species field — default to common_name
      const species  = (change.species as string | null) ?? (change.common_name as string) ?? 'Unknown'

      db.prepare(`
        INSERT INTO sightings (
          lbc_id, species, common_name, scientific_name, family,
          subspecies_common, subspecies_scientific,
          date, last_date, time, end_time,
          count, original_count, circa, age, status,
          breeding_code, breeding_category, behavior_code,
          observer, notes, original_location,
          created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        newLbcId, species, change.common_name, change.scientific_name, change.family,
        change.subspecies_common, change.subspecies_scientific,
        date, cleanDate(change.last_date),
        cleanTime(change.time), cleanTime(change.end_time),
        change.count, change.original_count, change.circa, change.age, change.status,
        change.breeding_code, change.breeding_category, change.behavior_code,
        change.observer, change.notes, change.original_location,
        change.created_at, change.updated_at
      )
      inserted++

      await apiPatch(`/sightings/${change.id}/assign-lbc-id`, { lbc_id: newLbcId })
      assigned++
    }
  }

  db.prepare("INSERT INTO settings(key,value) VALUES('last_sync_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(new Date().toISOString())

  return { updated, deleted, inserted, assigned }
}

export interface SyncStatus {
  pushedBatches:   number
  unpushedBatches: number
  lastSyncAt:      string | null
  batches: {
    id: number; filename: string; importedAt: string; rowCount: number; pushedAt: string | null
  }[]
}

export function getSyncStatus(): SyncStatus {
  const db = getSqlite()
  const batches = db.prepare(
    'SELECT id, filename, imported_at as importedAt, row_count as rowCount, pushed_at as pushedAt FROM import_batches ORDER BY imported_at DESC'
  ).all() as SyncStatus['batches']

  const pushedBatches   = batches.filter(b => b.pushedAt !== null).length
  const unpushedBatches = batches.filter(b => b.pushedAt === null).length
  const syncRow = db.prepare("SELECT value FROM settings WHERE key = 'last_sync_at'").get() as { value: string } | undefined

  return { pushedBatches, unpushedBatches, lastSyncAt: syncRow?.value ?? null, batches }
}
