import { FieldMapping, ParsedSighting, RawRow, ImportResult, BatchOptions } from './types'
import { parseDate } from './parseDate'

function str(row: RawRow, col: string | undefined): string | undefined {
  if (!col || row[col] == null) return undefined
  const s = String(row[col]).trim()
  return s !== '' ? s : undefined
}

function num(row: RawRow, col: string | undefined): number | undefined {
  if (!col || row[col] == null) return undefined
  const n = parseFloat(String(row[col]))
  return isNaN(n) ? undefined : n
}

/** Extract text inside the first set of parentheses, e.g. "Robin (Continental)" → "Continental" */
function extractBrackets(s: string): string | undefined {
  const m = s.match(/\(([^)]+)\)/)
  return m ? m[1].trim() : undefined
}

/** Extract subspecies scientific name: third+ token of a trinomial scientific name */
function extractSubspeciesScientific(scientificName: string | undefined): string | undefined {
  if (!scientificName) return undefined
  const parts = scientificName.trim().split(/\s+/)
  return parts.length >= 3 ? parts.slice(2).join(' ') : undefined
}

/**
 * Parse Original Total Count and Circa fields into normalised count + circa flag.
 *
 * Rules:
 *  - Circa column contains a number → that number becomes count (if count col empty),
 *    circa becomes "C"
 *  - "X", "present", "seen" in count col → count=1, circa="C"
 *  - "c5", "c.5", "c 5", "~5" prefix → strip prefix, circa="C"
 *  - Range "5-10" or "5–10" → lower bound, circa="C"
 *  - Plain number → count = that number; preserve existing circa value
 *  - Circa col "C"/"c" (already set) → normalise to "C"
 */
function parseCountAndCirca(
  rawCount: string | undefined,
  rawCirca: string | undefined,
): { count: number | undefined; circa: string | undefined } {
  let effectiveCount = rawCount?.trim()
  let effectiveCirca = rawCirca?.trim()

  // Circa column contains a number → it IS the count
  if (effectiveCirca && /^\d+(\.\d+)?$/.test(effectiveCirca)) {
    if (!effectiveCount) effectiveCount = effectiveCirca
    effectiveCirca = 'C'
  }

  if (!effectiveCount) {
    const circa = effectiveCirca && /^c$/i.test(effectiveCirca) ? 'C' : effectiveCirca || undefined
    return { count: undefined, circa }
  }

  // X / present / seen → 1 + C
  if (/^(x|present|seen)$/i.test(effectiveCount)) {
    return { count: 1, circa: 'C' }
  }

  // Circa prefix: "c5", "c.5", "c 5", "~5"
  const circaPrefix = effectiveCount.match(/^[c~]\s*\.?\s*(\d+(?:\.\d+)?)$/i)
  if (circaPrefix) {
    return { count: Math.round(parseFloat(circaPrefix[1])), circa: 'C' }
  }

  // Range: "5-10" or "5–10"
  const range = effectiveCount.match(/^(\d+)\s*[-–]\s*\d+$/)
  if (range) {
    return { count: parseInt(range[1]), circa: 'C' }
  }

  // Plain number
  const n = parseFloat(effectiveCount)
  if (!isNaN(n)) {
    const circa = effectiveCirca && /^c$/i.test(effectiveCirca) ? 'C' : effectiveCirca || undefined
    return { count: Math.round(n), circa }
  }

  // Unparseable — preserve as-is
  const circa = effectiveCirca && /^c$/i.test(effectiveCirca) ? 'C' : effectiveCirca || undefined
  return { count: undefined, circa }
}

export function normaliseRows(
  rows: RawRow[],
  mapping: FieldMapping,
  batchOptions: BatchOptions = {},
): ImportResult {
  const result: ImportResult = { rows: [], unmapped: [], warnings: [], failures: [] }
  const { dataset: batchDataset, defaultObserver } = batchOptions

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const lineRef = `row ${i + 2}`

    const rawDate = row[mapping.date]
    const rawSpecies = (mapping.species && row[mapping.species])
      || (mapping.originalCommonName && row[mapping.originalCommonName])
      || (mapping.originalScientificName && row[mapping.originalScientificName])
    const rawOriginalCount = mapping.originalCount && row[mapping.originalCount]

    if (!rawSpecies || !rawDate || !rawOriginalCount) {
      result.unmapped.push(row)
      const missing = [!rawDate && 'date', !rawSpecies && 'species name', !rawOriginalCount && 'original total count'].filter(Boolean).join(', ')
      const reason = `Missing required field (${missing})`
      result.warnings.push(`${lineRef}: ${reason}`)
      result.failures.push({ index: i, reason })
      continue
    }

    const date = parseDate(rawDate as string)
    if (!date) {
      result.unmapped.push(row)
      const reason = `Could not parse date "${rawDate}"`
      result.warnings.push(`${lineRef}: ${reason}`)
      result.failures.push({ index: i, reason })
      continue
    }

    const lastDateRaw = str(row, mapping.lastDate)
    const lastDate = lastDateRaw ? (parseDate(lastDateRaw) ?? undefined) : undefined

    // Count and circa derivation
    const { count, circa } = parseCountAndCirca(
      str(row, mapping.originalCount),
      str(row, mapping.circa),
    )

    // Species names (raw from file; species matching will enrich these later)
    const originalCommonName = str(row, mapping.originalCommonName)
    const originalScientificName = str(row, mapping.originalScientificName)

    // Mapped names take precedence; fall back to originals if not separately mapped
    const commonName = str(row, mapping.commonName) ?? originalCommonName
    const scientificName = str(row, mapping.scientificName) ?? originalScientificName

    // Subspecies derivation
    const subspeciesCommon = str(row, mapping.subspeciesCommon)
      ?? (originalCommonName ? extractBrackets(originalCommonName) : undefined)
    const subspeciesScientific = str(row, mapping.subspeciesScientific)
      ?? extractSubspeciesScientific(scientificName)

    // Observer: mapped column first, then batch default
    const observer = str(row, mapping.observer) ?? defaultObserver

    // Dataset: mapped column first, then batch default
    const dataset = str(row, mapping.dataset) ?? batchDataset

    const sighting: ParsedSighting = {
      species: String(rawSpecies).trim(),
      date,
      rawData: JSON.stringify(row),

      originalCommonName,
      commonName,
      originalScientificName,
      scientificName,
      family: str(row, mapping.family),
      subspeciesCommon,
      subspeciesScientific,

      lastDate,
      time:    str(row, mapping.time),
      endTime: str(row, mapping.endTime),

      count,
      originalCount: str(row, mapping.originalCount),
      circa,

      age:              str(row, mapping.age),
      status:           str(row, mapping.status),
      breedingCode:     str(row, mapping.breedingCode),
      breedingCategory: str(row, mapping.breedingCategory),
      behaviorCode:     str(row, mapping.behaviorCode),

      observer,
      notes: str(row, mapping.notes),

      lat:               num(row, mapping.lat),
      lon:               num(row, mapping.lon),
      uncertaintyRadius: num(row, mapping.uncertaintyRadius),
      geometryType:      str(row, mapping.geometryType),
      tripMapRef:        str(row, mapping.tripMapRef),
      locationName:      str(row, mapping.locationName),
      originalLocation:  str(row, mapping.originalLocation),

      occurrenceKey: str(row, mapping.occurrenceKey),
      dataset,
    }

    result.rows.push(sighting)
  }

  return result
}
