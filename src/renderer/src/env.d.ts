import type { FieldMapping, Location, Sighting } from '../../shared/types'

declare global {
  interface Window {
    api: {
      import: {
        openFile(): Promise<{ path: string; headers: string[]; preview: Record<string, unknown>[] } | null>
        commit(filePath: string, mapping: FieldMapping): Promise<{ imported: number; warnings: string[] }>
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
