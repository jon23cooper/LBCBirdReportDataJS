import type { FieldMapping, Location, Sighting, CommitResult, SpeciesRecord, BatchOptions } from '../../shared/types'

declare global {
  interface Window {
    api: {
      import: {
        openFile(): Promise<{ path: string; sheets: string[]; headers: string[]; preview: Record<string, unknown>[] } | null>
        readSheet(filePath: string, sheetName: string, skipRows: number): Promise<{ headers: string[]; preview: Record<string, unknown>[] }>
        commit(filePath: string, mapping: FieldMapping, sheetName?: string, skipRows?: number, batchOptions?: BatchOptions): Promise<CommitResult>
        commitRows(rows: Record<string, unknown>[], mapping: FieldMapping, filename: string, batchOptions?: BatchOptions): Promise<CommitResult>
      }
      sightings: {
        list(): Promise<Sighting[]>
      }
      locations: {
        list(): Promise<Location[]>
        upsert(data: Location): Promise<void>
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
