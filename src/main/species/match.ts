import { getSqlite } from '../db'

export type MatchQuality = 'exact-scientific' | 'exact-common' | 'regex-scientific' | 'regex-common' | 'none'

export interface SpeciesMatch {
  commonName: string
  scientificName: string
  family: string | null
  quality: MatchQuality
}

interface CachedSpecies {
  commonName: string
  commonNameRegex: string | null
  scientificName: string
  scientificNameRegex: string | null
  family: string | null
}

let _cache: CachedSpecies[] | null = null

export function invalidateSpeciesCache(): void {
  _cache = null
}

function getSpecies(): CachedSpecies[] {
  if (_cache !== null) return _cache
  const rows = getSqlite()
    .prepare('SELECT common_name, common_name_regex, scientific_name, scientific_name_regex, family FROM species')
    .all() as Record<string, string | null>[]
  _cache = rows.map(r => ({
    commonName:         r.common_name as string,
    commonNameRegex:    r.common_name_regex,
    scientificName:     r.scientific_name as string,
    scientificNameRegex: r.scientific_name_regex,
    family:             r.family,
  }))
  return _cache
}

function testRegex(pattern: string | null | undefined, value: string): boolean {
  if (!pattern) return false
  try {
    return new RegExp(pattern, 'i').test(value)
  } catch {
    return false
  }
}

export function matchSpecies(
  originalCommonName: string | undefined,
  originalScientificName: string | undefined,
): SpeciesMatch {
  const list = getSpecies()
  const cn = originalCommonName?.trim()
  const sn = originalScientificName?.trim()
  const cnLower = cn?.toLowerCase()
  const snLower = sn?.toLowerCase()

  // 1. Exact scientific name
  if (snLower) {
    const m = list.find(s => s.scientificName.toLowerCase() === snLower)
    if (m) return { commonName: m.commonName, scientificName: m.scientificName, family: m.family, quality: 'exact-scientific' }
  }

  // 2. Exact common name
  if (cnLower) {
    const m = list.find(s => s.commonName.toLowerCase() === cnLower)
    if (m) return { commonName: m.commonName, scientificName: m.scientificName, family: m.family, quality: 'exact-common' }
  }

  // 3. Regex scientific name
  if (sn) {
    const m = list.find(s => testRegex(s.scientificNameRegex, sn))
    if (m) return { commonName: m.commonName, scientificName: m.scientificName, family: m.family, quality: 'regex-scientific' }
  }

  // 4. Regex common name
  if (cn) {
    const m = list.find(s => testRegex(s.commonNameRegex, cn))
    if (m) return { commonName: m.commonName, scientificName: m.scientificName, family: m.family, quality: 'regex-common' }
  }

  return { commonName: cn ?? '', scientificName: sn ?? '', family: null, quality: 'none' }
}
