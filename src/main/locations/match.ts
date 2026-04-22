import { getDb } from '../db'
import { locations } from '../db/schema'
import { like } from 'drizzle-orm'
import * as turf from '@turf/turf'

const MATCH_RADIUS_KM = 0.5

export async function findLocationByName(name: string): Promise<number | null> {
  const db = getDb()
  const rows = await db
    .select()
    .from(locations)
    .where(like(locations.name, `%${name}%`))
    .limit(1)
  return rows[0]?.id ?? null
}

export async function findLocationByCoords(lat: number, lon: number): Promise<number | null> {
  const db = getDb()
  const all = await db.select().from(locations)
  const point = turf.point([lon, lat])

  for (const loc of all) {
    if (loc.lat == null || loc.lon == null) continue
    const candidate = turf.point([loc.lon, loc.lat])
    const dist = turf.distance(point, candidate, { units: 'kilometers' })
    if (dist <= MATCH_RADIUS_KM) return loc.id
  }
  return null
}

export async function resolveLocationId(
  locationName?: string,
  lat?: number,
  lon?: number
): Promise<number | null> {
  if (lat != null && lon != null) {
    const byCoords = await findLocationByCoords(lat, lon)
    if (byCoords) return byCoords
  }
  if (locationName) {
    return findLocationByName(locationName)
  }
  return null
}
