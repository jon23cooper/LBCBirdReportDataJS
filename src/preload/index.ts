import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  import: {
    openFile: () => ipcRenderer.invoke('import:open-file'),
    commit: (filePath: string, mapping: object) =>
      ipcRenderer.invoke('import:commit', filePath, mapping)
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
