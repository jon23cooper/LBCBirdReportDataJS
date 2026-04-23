import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  import: {
    openFile: () => ipcRenderer.invoke('import:open-file'),
    readSheet: (filePath: string, sheetName: string, skipRows: number) =>
      ipcRenderer.invoke('import:read-sheet', filePath, sheetName, skipRows),
    commit: (filePath: string, mapping: object, sheetName?: string, skipRows?: number) =>
      ipcRenderer.invoke('import:commit', filePath, mapping, sheetName, skipRows)
  },
  sightings: {
    list: () => ipcRenderer.invoke('sightings:list')
  },
  locations: {
    list: () => ipcRenderer.invoke('locations:list'),
    upsert: (data: object) => ipcRenderer.invoke('locations:upsert', data)
  },
  export: {
    sql: () => ipcRenderer.invoke('export:sql')
  }
})
