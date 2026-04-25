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
      }
      locations: {
        list(): Promise<Location[]>
        upsert(data: Location): Promise<void>
        openGeojsonFile(): Promise<string | null>
        importGeojson(filePath: string): Promise<{ imported: number; errors: string[] }>
        openRegexCsvFile(): Promise<string | null>
        importRegexCsv(filePath: string): Promise<{ imported: number; errors: string[] }>
        confirmMatch(rawString: string, locationId: number): Promise<void>
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
    }
  }
}

export {}
