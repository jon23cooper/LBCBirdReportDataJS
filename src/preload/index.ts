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
    commitStaged: (rows: object[], filename: string, format: string, mapping: object) =>
      ipcRenderer.invoke('import:commit-staged', rows, filename, format, mapping)
  },
  sightings: {
    list: () => ipcRenderer.invoke('sightings:list')
  },
  locations: {
    list: () => ipcRenderer.invoke('locations:list'),
    upsert: (data: object) => ipcRenderer.invoke('locations:upsert', data)
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
