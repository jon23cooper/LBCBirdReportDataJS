import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  import: {
    openFile: () => ipcRenderer.invoke('import:open-file'),
    readSheet: (filePath: string, sheetName: string) =>
      ipcRenderer.invoke('import:read-sheet', filePath, sheetName),
    commit: (filePath: string, mapping: object, sheetName?: string) =>
      ipcRenderer.invoke('import:commit', filePath, mapping, sheetName)
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
