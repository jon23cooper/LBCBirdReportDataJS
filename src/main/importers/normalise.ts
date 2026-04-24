import { FieldMapping, ParsedSighting, RawRow, ImportResult } from './types'
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

function int(row: RawRow, col: string | undefined): number | undefined {
  if (!col || row[col] == null) return undefined
  const n = parseInt(String(row[col]))
  return isNaN(n) ? undefined : n
}

export function normaliseRows(rows: RawRow[], mapping: FieldMapping): ImportResult {
  const result: ImportResult = { rows: [], unmapped: [], warnings: [], failures: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const lineRef = `row ${i + 2}`

    const rawDate = row[mapping.date]
    const rawSpecies = (mapping.species && row[mapping.species])
      || (mapping.originalCommonName && row[mapping.originalCommonName])
      || (mapping.originalScientificName && row[mapping.originalScientificName])

    if (!rawSpecies || !rawDate) {
      result.unmapped.push(row)
      const reason = 'Missing required field (species name or date)'
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

    const sighting: ParsedSighting = {
      species: String(rawSpecies).trim(),
      date,
      rawData: JSON.stringify(row),

      originalCommonName:   str(row, mapping.originalCommonName),
      commonName:           str(row, mapping.commonName),
      originalScientificName: str(row, mapping.originalScientificName),
      scientificName:       str(row, mapping.scientificName),
      family:               str(row, mapping.family),
      subspeciesCommon:     str(row, mapping.subspeciesCommon),
      subspeciesScientific: str(row, mapping.subspeciesScientific),

      lastDate,
      time:    str(row, mapping.time),
      endTime: str(row, mapping.endTime),

      count:         int(row, mapping.count),
      originalCount: str(row, mapping.originalCount),
      circa:         str(row, mapping.circa),

      age:              str(row, mapping.age),
      status:           str(row, mapping.status),
      breedingCode:     str(row, mapping.breedingCode),
      breedingCategory: str(row, mapping.breedingCategory),
      behaviorCode:     str(row, mapping.behaviorCode),

      observer: str(row, mapping.observer),
      notes:    str(row, mapping.notes),

      lat:               num(row, mapping.lat),
      lon:               num(row, mapping.lon),
      uncertaintyRadius: num(row, mapping.uncertaintyRadius),
      geometryType:      str(row, mapping.geometryType),
      tripMapRef:        str(row, mapping.tripMapRef),
      locationName:      str(row, mapping.locationName),
      originalLocation:  str(row, mapping.originalLocation),

      occurrenceKey: str(row, mapping.occurrenceKey),
      dataset:       str(row, mapping.dataset),
      lbcId:         str(row, mapping.lbcId),
    }

    result.rows.push(sighting)
  }

  return result
}
