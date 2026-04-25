import * as turf from '@turf/turf'
import { getSqlite } from '../db'

interface CachedSite {
  id: number
  name: string
  centroidLat: number | null
  centroidLon: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geometry: any | null
}

interface CachedRegex {
  siteName: string
  pattern: RegExp
  matchName: string
}

interface Cache {
  sites: CachedSite[]
  regexes: CachedRegex[]
}

let _cache: Cache | null = null

export function invalidateLocationCache(): void { _cache = null }

function getCache(): Cache {
  if (_cache) return _cache
  const db = getSqlite()

  const siteRows = db.prepare(
    'SELECT id, name, centroid_lat, centroid_lon, geometry FROM locations'
  ).all() as Array<{ id: number; name: string; centroid_lat: number | null; centroid_lon: number | null; geometry: string | null }>

  const regexRows = db.prepare(
    'SELECT site_name, regex, match_name FROM location_regex'
  ).all() as Array<{ site_name: string; regex: string; match_name: string | null }>

  const sites: CachedSite[] = siteRows.map(r => ({
    id: r.id,
    name: r.name,
    centroidLat: r.centroid_lat,
    centroidLon: r.centroid_lon,
    geometry: r.geometry ? JSON.parse(r.geometry) : null,
  }))

  const regexes: CachedRegex[] = regexRows.flatMap(r => {
    try {
      return [{ siteName: r.site_name, pattern: new RegExp(r.regex, 'i'), matchName: r.match_name ?? r.site_name }]
    } catch { return [] }
  })

  _cache = { sites, regexes }
  return _cache
}

export type LocationMatchQuality = 'cache' | 'confirmed' | 'spatial-only' | 'name-only' | 'conflict' | 'none'

export interface LocationCandidate {
  locationId: number
  name: string
  matchName?: string
  distanceKm?: number
  quality: LocationMatchQuality
}

export interface LocationMatchResult {
  locationId: number | null
  quality: LocationMatchQuality
  matchName?: string
  candidates: LocationCandidate[]
}

const NEARBY_KM = 2

export function matchLocation(
  locationName?: string,
  lat?: number,
  lon?: number,
): LocationMatchResult {
  const { sites, regexes } = getCache()

  const locationNameTrimmed = locationName?.replace(/^\s+|\s+$/gu, '') || undefined

  // Check match cache first
  if (locationNameTrimmed) {
    const cached = getSqlite().prepare(
      'SELECT location_id FROM location_match_cache WHERE raw_string = ?'
    ).get(locationNameTrimmed) as { location_id: number } | undefined
    if (cached) {
      const site = sites.find(s => s.id === cached.location_id)
      return { locationId: cached.location_id, quality: 'cache', matchName: site?.name, candidates: [] }
    }
  }

  // Spatial matching
  const point = (lat != null && lon != null) ? turf.point([lon, lat]) : null
  const containingSiteIds = new Set<number>()
  const nearbyWithDist: Array<{ site: CachedSite; distanceKm: number }> = []

  if (point) {
    for (const site of sites) {
      if (site.geometry) {
        try {
          if (turf.booleanPointInPolygon(point, site.geometry)) {
            containingSiteIds.add(site.id)
            continue
          }
        } catch { /* malformed geometry */ }
      }
      if (site.centroidLat != null && site.centroidLon != null) {
        const dist = turf.distance(point, turf.point([site.centroidLon, site.centroidLat]), { units: 'kilometers' })
        if (dist <= NEARBY_KM) nearbyWithDist.push({ site, distanceKm: dist })
      }
    }
    nearbyWithDist.sort((a, b) => a.distanceKm - b.distanceKm)
  }

  // Regex name matching
  const nameMatchedSiteNames = new Set<string>()
  const nameMatchDetails = new Map<string, string>()

  if (locationNameTrimmed) {
    for (const rx of regexes) {
      if (!nameMatchedSiteNames.has(rx.siteName) && rx.pattern.test(locationNameTrimmed)) {
        nameMatchedSiteNames.add(rx.siteName)
        nameMatchDetails.set(rx.siteName, rx.matchName)
      }
    }
  }

  const containingSites = sites.filter(s => containingSiteIds.has(s.id))
  const hasSpatial = containingSites.length > 0
  const hasName = nameMatchedSiteNames.size > 0

  let quality: LocationMatchQuality = 'none'
  let locationId: number | null = null
  let matchName: string | undefined

  if (hasSpatial && hasName) {
    const agreed = containingSites.find(s => nameMatchedSiteNames.has(s.name))
    if (agreed) {
      quality = 'confirmed'
      locationId = agreed.id
      matchName = nameMatchDetails.get(agreed.name)
    } else {
      quality = 'conflict'
    }
  } else if (hasSpatial) {
    quality = 'spatial-only'
    locationId = containingSites[0].id
    matchName = containingSites[0].name
  } else if (hasName) {
    quality = 'name-only'
    const nameSite = sites.find(s => nameMatchedSiteNames.has(s.name))!
    locationId = nameSite.id
    matchName = nameMatchDetails.get(nameSite.name)
  }

  const candidates = buildCandidates(containingSites, nearbyWithDist, nameMatchedSiteNames, nameMatchDetails, sites)
  return { locationId, quality, matchName, candidates }
}

function buildCandidates(
  containingSites: CachedSite[],
  nearbyWithDist: Array<{ site: CachedSite; distanceKm: number }>,
  nameMatchedSiteNames: Set<string>,
  nameMatchDetails: Map<string, string>,
  allSites: CachedSite[],
): LocationCandidate[] {
  const seen = new Set<number>()
  const result: LocationCandidate[] = []

  for (const site of containingSites) {
    if (seen.has(site.id)) continue
    seen.add(site.id)
    result.push({ locationId: site.id, name: site.name, matchName: nameMatchDetails.get(site.name), quality: nameMatchedSiteNames.has(site.name) ? 'confirmed' : 'spatial-only' })
  }
  for (const { site, distanceKm } of nearbyWithDist.slice(0, 5)) {
    if (seen.has(site.id)) continue
    seen.add(site.id)
    result.push({ locationId: site.id, name: site.name, matchName: nameMatchDetails.get(site.name), distanceKm, quality: nameMatchedSiteNames.has(site.name) ? 'name-only' : 'none' })
  }
  for (const siteName of nameMatchedSiteNames) {
    const site = allSites.find(s => s.name === siteName)
    if (!site || seen.has(site.id)) continue
    seen.add(site.id)
    result.push({ locationId: site.id, name: site.name, matchName: nameMatchDetails.get(site.name), quality: 'name-only' })
  }
  return result.slice(0, 5)
}

export function confirmLocationMatch(rawString: string, locationId: number): void {
  getSqlite().prepare(
    `INSERT INTO location_match_cache(raw_string, location_id, confirmed_at)
     VALUES(?, ?, ?)
     ON CONFLICT(raw_string) DO UPDATE SET location_id=excluded.location_id, confirmed_at=excluded.confirmed_at`
  ).run(rawString.trim(), locationId, new Date().toISOString())
}
