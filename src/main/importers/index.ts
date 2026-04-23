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

function readXlsx(filePath: string, sheetName?: string, skipRows = 0): { headers: string[]; rows: RawRow[] } {
  const wb = XLSX.readFile(filePath)
  const name = (sheetName && wb.SheetNames.includes(sheetName)) ? sheetName : wb.SheetNames[0]
  const ws = wb.Sheets[name]
  const data = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: false, range: skipRows })
  const headers = data.length > 0 ? Object.keys(data[0]) : []
  return { headers, rows: data }
}

function readOds(filePath: string, sheetName?: string, skipRows = 0): { headers: string[]; rows: RawRow[] } {
  const wb = XLSX.readFile(filePath, { type: 'file' })
  const name = (sheetName && wb.SheetNames.includes(sheetName)) ? sheetName : wb.SheetNames[0]
  const ws = wb.Sheets[name]
  const data = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: false, range: skipRows })
  const headers = data.length > 0 ? Object.keys(data[0]) : []
  return { headers, rows: data }
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
