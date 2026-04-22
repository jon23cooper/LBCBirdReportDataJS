export interface RawRow {
  [key: string]: string | number | null
}

export interface FieldMapping {
  species: string
  date: string
  locationName?: string
  lat?: string
  lon?: string
  count?: string
  observer?: string
  notes?: string
  [key: string]: string | undefined
}

export interface ParsedSighting {
  species: string
  date: string
  time?: string
  count?: number
  countApprox?: number
  observer?: string
  notes?: string
  lat?: number
  lon?: number
  locationName?: string
  rawData: string
}

export interface ImportResult {
  rows: ParsedSighting[]
  unmapped: RawRow[]
  warnings: string[]
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
  species: string
  commonName?: string | null
  scientificName?: string | null
  date: string
  time?: string | null
  count?: number | null
  observer?: string | null
  notes?: string | null
  lat?: number | null
  lon?: number | null
}
