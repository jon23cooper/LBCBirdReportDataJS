import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Load .env file and extract non-VITE_ vars for injection into the main process
function loadMainEnv(): Record<string, string> {
  const defines: Record<string, string> = {}
  try {
    const lines = readFileSync(resolve('.env'), 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      if (key && !key.startsWith('VITE_')) {
        defines[`process.env.${key}`] = JSON.stringify(val)
      }
    }
  } catch {
    console.warn('electron-vite: could not read .env file')
  }
  return defines
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: loadMainEnv(),
    resolve: {
      alias: { '@main': resolve('src/main') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: { '@renderer': resolve('src/renderer/src') }
    }
  }
})
