import { readFileSync } from 'fs'
import { extname } from 'path'
import { parse as parseCsv } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { RawRow } from './types'

export function readSpreadsheet(filePath: string): { headers: string[]; rows: RawRow[] } {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.csv') return readCsv(filePath)
  if (ext === '.xlsx' || ext === '.xls') return readXlsx(filePath)
  if (ext === '.ods') return readOds(filePath)

  throw new Error(`Unsupported file format: ${ext}`)
}

function readCsv(filePath: string): { headers: string[]; rows: RawRow[] } {
  const content = readFileSync(filePath, 'utf-8')
  const records: string[][] = parseCsv(content, { relax_quotes: true, skip_empty_lines: true })
  if (records.length === 0) return { headers: [], rows: [] }
  const [headers, ...dataRows] = records
  const rows = dataRows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null]))
  )
  return { headers, rows }
}

function readXlsx(filePath: string): { headers: string[]; rows: RawRow[] } {
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: false })
  const headers = data.length > 0 ? Object.keys(data[0]) : []
  return { headers, rows: data }
}

function readOds(filePath: string): { headers: string[]; rows: RawRow[] } {
  // xlsx library supports ODS natively
  const wb = XLSX.readFile(filePath, { type: 'file' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: false })
  const headers = data.length > 0 ? Object.keys(data[0]) : []
  return { headers, rows: data }
}
