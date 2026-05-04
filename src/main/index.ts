import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { initDb } from './db'
import { registerIpcHandlers, registerSyncHandlers } from './ipc'

// Load .env file from project root into process.env.
// __dirname in the built main process is <project>/out/main/
// so ../../.env resolves to <project>/.env
function loadEnv(): void {
  const candidates = [
    join(__dirname, '../../.env'),           // dev: out/main → project root
    join(app.getPath('exe'), '../../../.env') // packaged fallback
  ]
  for (const envPath of candidates) {
    try {
      const lines = readFileSync(envPath, 'utf-8').split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (key && !(key in process.env)) process.env[key] = val
      }
      console.log(`[env] Loaded from ${envPath}`)
      return
    } catch {
      // try next candidate
    }
  }
  console.warn('[env] No .env file found — LBC_API_URL and LBC_API_KEY must be set externally')
}

loadEnv()

function createWindow(): void {
  const win = new BrowserWindow({
    width: 2200,
    height: 1400,
    minWidth: 960,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    },
  })

  win.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  try {
    initDb()
  } catch (err) {
    console.error('DB init failed:', err)
  }
  registerIpcHandlers()
  registerSyncHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in main process:', err)
})
