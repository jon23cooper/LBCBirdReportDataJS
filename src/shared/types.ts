export interface RawRow {
  [key: string]: string | number | null
}

// Maps standard field keys → spreadsheet column names
export interface FieldMapping {
  species: string     // required
  date: string        // required
  originalCommonName?: string
  commonName?: string
  originalScientificName?: string
  scientificName?: string
  family?: string
  subspeciesCommon?: string
  subspeciesScientific?: string
  locationName?: string
  originalLocation?: string
  lastDate?: string
  time?: string
  endTime?: string
  count?: string
  originalCount?: string
  circa?: string
  observer?: string
  notes?: string
  status?: string
  age?: string
  breedingCode?: string
  breedingCategory?: string
  behaviorCode?: string
  tripMapRef?: string
  lat?: string
  lon?: string
  uncertaintyRadius?: string
  geometryType?: string
  lbcId?: string
  occurrenceKey?: string
  dataset?: string
  [key: string]: string | undefined
}

export interface ParsedSighting {
  // Required
  species: string
  date: string
  rawData: string

  // Taxonomic
  originalCommonName?: string
  commonName?: string
  originalScientificName?: string
  scientificName?: string
  family?: string
  subspeciesCommon?: string
  subspeciesScientific?: string

  // Dates / times
  lastDate?: string
  time?: string
  endTime?: string

  // Count
  count?: number
  originalCount?: string
  circa?: string

  // Observation detail
  age?: string
  status?: string
  breedingCode?: string
  breedingCategory?: string
  behaviorCode?: string

  // Observer
  observer?: string
  notes?: string

  // Spatial
  lat?: number
  lon?: number
  uncertaintyRadius?: number
  geometryType?: string
  tripMapRef?: string
  locationName?: string
  originalLocation?: string

  // Reference
  occurrenceKey?: string
  dataset?: string
  lbcId?: string

  // Match quality (staging only, not persisted)
  speciesMatchQuality?: string
}

export interface StagingData {
  rows: ParsedSighting[]
  warnings: string[]
  filename: string
  format: string
  mapping: Partial<FieldMapping>
  batchOptions: BatchOptions
}

export interface RowFailure {
  index: number
  reason: string
}

export interface ImportResult {
  rows: ParsedSighting[]
  unmapped: RawRow[]
  warnings: string[]
  failures: RowFailure[]
}

export type CommitResult =
  | { status: 'success'; imported: number; warnings: string[] }
  | { status: 'validation-failed'; headers: string[]; allRows: RawRow[]; failures: RowFailure[] }

export interface SpeciesRecord {
  id?: number
  commonName: string
  commonNameRegex?: string | null
  scientificName: string
  scientificNameRegex?: string | null
  family?: string | null
}

export interface BatchOptions {
  dataset?: string
  defaultObserver?: string
  lbcSeqStart?: number
}

export interface Location {
  id?: number
  name: string
  gridRef?: string | null
  lat?: number | null
  lon?: number | null
  country?: string | null
  region?: string | null
  notes?: string | null
}

export interface Sighting {
  id?: number
  importBatchId?: number | null
  locationId?: number | null
  occurrenceKey?: string | null
  dataset?: string | null
  lbcId?: string | null
  species: string
  originalCommonName?: string | null
  commonName?: string | null
  originalScientificName?: string | null
  scientificName?: string | null
  family?: string | null
  subspeciesCommon?: string | null
  subspeciesScientific?: string | null
  date: string
  lastDate?: string | null
  time?: string | null
  endTime?: string | null
  count?: number | null
  originalCount?: string | null
  circa?: string | null
  age?: string | null
  status?: string | null
  breedingCode?: string | null
  breedingCategory?: string | null
  behaviorCode?: string | null
  observer?: string | null
  notes?: string | null
  lat?: number | null
  lon?: number | null
  uncertaintyRadius?: number | null
  geometryType?: string | null
  tripMapRef?: string | null
  originalLocation?: string | null
  sourceRef?: string | null
  rawData?: string | null
}
