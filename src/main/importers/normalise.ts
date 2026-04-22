import { FieldMapping, ParsedSighting, RawRow, ImportResult } from './types'
import { parseDate } from './parseDate'

export function normaliseRows(rows: RawRow[], mapping: FieldMapping): ImportResult {
  const result: ImportResult = { rows: [], unmapped: [], warnings: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const lineRef = `row ${i + 2}` // 1-indexed + header

    const rawSpecies = row[mapping.species]
    const rawDate = row[mapping.date]

    if (!rawSpecies || !rawDate) {
      result.unmapped.push(row)
      result.warnings.push(`${lineRef}: missing required field (species or date), skipped`)
      continue
    }

    const date = parseDate(rawDate as string)
    if (!date) {
      result.unmapped.push(row)
      result.warnings.push(`${lineRef}: could not parse date "${rawDate}", skipped`)
      continue
    }

    const sighting: ParsedSighting = {
      species: String(rawSpecies).trim(),
      date,
      rawData: JSON.stringify(row)
    }

    if (mapping.count) {
      const raw = row[mapping.count]
      const n = parseInt(String(raw))
      if (!isNaN(n)) sighting.count = n
    }
    if (mapping.observer && row[mapping.observer]) {
      sighting.observer = String(row[mapping.observer]).trim()
    }
    if (mapping.notes && row[mapping.notes]) {
      sighting.notes = String(row[mapping.notes]).trim()
    }
    if (mapping.locationName && row[mapping.locationName]) {
      sighting.locationName = String(row[mapping.locationName]).trim()
    }
    if (mapping.lat && row[mapping.lat]) {
      const lat = parseFloat(String(row[mapping.lat]))
      if (!isNaN(lat)) sighting.lat = lat
    }
    if (mapping.lon && row[mapping.lon]) {
      const lon = parseFloat(String(row[mapping.lon]))
      if (!isNaN(lon)) sighting.lon = lon
    }

    result.rows.push(sighting)
  }

  return result
}
