import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  import: {
    openFile: () => ipcRenderer.invoke('import:open-file'),
    readSheet: (filePath: string, sheetName: string, skipRows: number) =>
      ipcRenderer.invoke('import:read-sheet', filePath, sheetName, skipRows),
    validate: (filePath: string, mapping: object, sheetName?: string, skipRows?: number, batchOptions?: object) =>
      ipcRenderer.invoke('import:validate', filePath, mapping, sheetName, skipRows, batchOptions),
    validateRows: (rows: object[], mapping: object, batchOptions?: object) =>
      ipcRenderer.invoke('import:validate-rows', rows, mapping, batchOptions),
    commitStaged: (rows: object[], filename: string, format: string, mapping: object, sourceFilePath?: string) =>
      ipcRenderer.invoke('import:commit-staged', rows, filename, format, mapping, sourceFilePath)
  },
  sightings: {
    list: () => ipcRenderer.invoke('sightings:list')
  },
  locations: {
    list: () => ipcRenderer.invoke('locations:list'),
    upsert: (data: object) => ipcRenderer.invoke('locations:upsert', data),
    openGeojsonFile: () => ipcRenderer.invoke('locations:open-geojson-file'),
    importGeojson: (filePath: string) => ipcRenderer.invoke('locations:import-geojson', filePath),
    openRegexCsvFile: () => ipcRenderer.invoke('locations:open-regex-csv-file'),
    importRegexCsv: (filePath: string) => ipcRenderer.invoke('locations:import-regex-csv', filePath),
    confirmMatch: (rawString: string, locationId: number) => ipcRenderer.invoke('locations:confirm-match', rawString, locationId),
    get: (id: number) => ipcRenderer.invoke('locations:get', id),
    listGeometries: () => ipcRenderer.invoke('locations:list-geometries'),
    listRegex: (siteName: string) => ipcRenderer.invoke('locations:list-regex', siteName),
    saveRegex: (siteName: string, rows: object[]) => ipcRenderer.invoke('locations:save-regex', siteName, rows),
  },
  species: {
    list: () => ipcRenderer.invoke('species:list'),
    upsert: (record: object) => ipcRenderer.invoke('species:upsert', record),
    importCsv: (filePath: string) => ipcRenderer.invoke('species:import-csv', filePath),
    openCsvFile: () => ipcRenderer.invoke('species:open-csv-file'),
  },
  export: {
    sql: () => ipcRenderer.invoke('export:sql')
  }
})
