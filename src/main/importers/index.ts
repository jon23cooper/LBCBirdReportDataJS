import { readFileSync } from 'fs'
import { extname } from 'path'
import { parse as parseCsv } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { RawRow } from './types'

export function getSheetNames(filePath: string): string[] {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.csv') return []
  const wb = XLSX.readFile(filePath, { bookSheets: true })
  return wb.SheetNames
}

export function readSpreadsheet(
  filePath: string,
  sheetName?: string,
  skipRows = 0
): { headers: string[]; rows: RawRow[] } {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.csv') return readCsv(filePath, skipRows)
  if (ext === '.xlsx' || ext === '.xls') return readXlsx(filePath, sheetName, skipRows)
  if (ext === '.ods') return readOds(filePath, sheetName, skipRows)

  throw new Error(`Unsupported file format: ${ext}`)
}

function readCsv(filePath: string, skipRows = 0): { headers: string[]; rows: RawRow[] } {
  const content = readFileSync(filePath, 'utf-8')
  const records: string[][] = parseCsv(content, { relax_quotes: true, skip_empty_lines: true })
  const trimmed = records.slice(skipRows)
  if (trimmed.length === 0) return { headers: [], rows: [] }
  const [rawHeaders, ...dataRows] = trimmed
  const headers = makeUniqueHeaders(rawHeaders)
  const rows = dataRows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null]))
  )
  return { headers, rows }
}

// SheetJS does not apply the 1904 epoch correction when cellDates:true; compensate manually.
const DATE1904_OFFSET_MS = 1462 * 24 * 60 * 60 * 1000

function datesToIso(rows: RawRow[], date1904 = false): RawRow[] {
  return rows.map(row =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => {
        if (v instanceof Date) {
          // Time-only Excel cells have serial 0–1, which SheetJS maps to 1899-12-30
          if (v.getUTCFullYear() <= 1899) {
            const h = String(v.getUTCHours()).padStart(2, '0')
            const m = String(v.getUTCMinutes()).padStart(2, '0')
            return [k, `${h}:${m}`]
          }
          const d = date1904 ? new Date(v.getTime() + DATE1904_OFFSET_MS) : v
          return [k, `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`]
        }
        return [k, v]
      })
    )
  )
}

function readXlsx(filePath: string, sheetName?: string, skipRows = 0): { headers: string[]; rows: RawRow[] } {
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const name = (sheetName && wb.SheetNames.includes(sheetName)) ? sheetName : wb.SheetNames[0]
  const ws = wb.Sheets[name]
  const date1904 = wb.Workbook?.WBProps?.date1904 ?? false
  const data = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: true, range: skipRows })
  const rows = datesToIso(data, date1904)
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  return { headers, rows }
}

function readOds(filePath: string, sheetName?: string, skipRows = 0): { headers: string[]; rows: RawRow[] } {
  const wb = XLSX.readFile(filePath, { cellDates: true, type: 'file' })
  const name = (sheetName && wb.SheetNames.includes(sheetName)) ? sheetName : wb.SheetNames[0]
  const ws = wb.Sheets[name]
  const data = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: true, range: skipRows })
  const rows = datesToIso(data)
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  return { headers, rows }
}

function makeUniqueHeaders(raw: (string | null | undefined)[]): string[] {
  const seen = new Map<string, number>()
  return raw.map((h, i) => {
    const base = (h != null && String(h).trim() !== '') ? String(h).trim() : `(column ${i + 1})`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base} (${count + 1})`
  })
}
