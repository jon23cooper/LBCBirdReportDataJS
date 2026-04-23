import type { FieldMapping, Location, Sighting } from '../../shared/types'

declare global {
  interface Window {
    api: {
      import: {
        openFile(): Promise<{ path: string; sheets: string[]; headers: string[]; preview: Record<string, unknown>[] } | null>
        readSheet(filePath: string, sheetName: string, skipRows: number): Promise<{ headers: string[]; preview: Record<string, unknown>[] }>
        commit(filePath: string, mapping: FieldMapping, sheetName?: string, skipRows?: number): Promise<{ imported: number; warnings: string[] }>
      }
      sightings: {
        list(): Promise<Sighting[]>
      }
      locations: {
        list(): Promise<Location[]>
        upsert(data: Location): Promise<void>
      }
      export: {
        sql(): Promise<string | null>
      }
    }
  }
}

export {}
