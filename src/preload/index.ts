import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  import: {
    openFile: () => ipcRenderer.invoke('import:open-file'),
    readSheet: (filePath: string, sheetName: string, skipRows: number) =>
      ipcRenderer.invoke('import:read-sheet', filePath, sheetName, skipRows),
    commit: (filePath: string, mapping: object, sheetName?: string, skipRows?: number, batchOptions?: object) =>
      ipcRenderer.invoke('import:commit', filePath, mapping, sheetName, skipRows, batchOptions),
    commitRows: (rows: object[], mapping: object, filename: string, batchOptions?: object) =>
      ipcRenderer.invoke('import:commit-rows', rows, mapping, filename, batchOptions)
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
