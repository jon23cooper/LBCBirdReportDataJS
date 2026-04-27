import type { FieldMapping, Location, LocationRegexRow, Sighting, ParsedSighting, RowFailure, RawRow, SpeciesRecord, BatchOptions } from '../../shared/types'

type ValidateResult =
  | { status: 'ok'; rows: ParsedSighting[]; warnings: string[] }
  | { status: 'validation-failed'; headers: string[]; allRows: RawRow[]; failures: RowFailure[] }

declare global {
  interface Window {
    api: {
      import: {
        openFile(): Promise<{ path: string; sheets: string[]; headers: string[]; preview: Record<string, unknown>[] } | null>
        readSheet(filePath: string, sheetName: string, skipRows: number): Promise<{ headers: string[]; preview: Record<string, unknown>[] }>
        validate(filePath: string, mapping: FieldMapping, sheetName?: string, skipRows?: number, batchOptions?: BatchOptions): Promise<ValidateResult>
        validateRows(rows: Record<string, unknown>[], mapping: FieldMapping, batchOptions?: BatchOptions): Promise<ValidateResult>
        commitStaged(rows: ParsedSighting[], filename: string, format: string, mapping: Partial<FieldMapping>, sourceFilePath?: string): Promise<{ imported: number }>
      }
      sightings: {
        list(): Promise<Sighting[]>
        delete(id: number): Promise<void>
        update(id: number, changes: Partial<Sighting>): Promise<void>
      }
      locations: {
        list(): Promise<Location[]>
        upsert(data: Location): Promise<void>
        openGeojsonFile(): Promise<string | null>
        importGeojson(filePath: string): Promise<{ imported: number; errors: string[] }>
        openRegexCsvFile(): Promise<string | null>
        importRegexCsv(filePath: string): Promise<{ imported: number; errors: string[] }>
        confirmMatch(rawString: string, locationId: number): Promise<void>
        listCache(): Promise<{ rawString: string; locationName: string; confirmedAt: string }[]>
        listCacheForLocation(locationId: number): Promise<{ rawString: string; confirmedAt: string }[]>
        deleteCacheEntry(rawString: string): Promise<void>
        get(id: number): Promise<Location>
        listGeometries(): Promise<{ id: number; name: string; geometry: string }[]>
        listRegex(siteName: string): Promise<LocationRegexRow[]>
        saveRegex(siteName: string, rows: LocationRegexRow[]): Promise<void>
      }
      species: {
        list(): Promise<SpeciesRecord[]>
        upsert(record: SpeciesRecord): Promise<void>
        importCsv(filePath: string): Promise<{ imported: number; errors: string[] }>
        openCsvFile(): Promise<string | null>
      }
      export: {
        sql(): Promise<string | null>
      }
      batches: {
        list(): Promise<{ id: number; filename: string; format: string; importedAt: string; rowCount: number | null; storedFile: string | null }[]>
        delete(id: number): Promise<void>
        revealFile(storedFile: string): Promise<void>
        openFile(storedFile: string): Promise<void>
        locateFile(id: number): Promise<string | null>
      }
    }
  }
}

export {}
