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
  sheetName?: string
): { headers: string[]; rows: RawRow[] } {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.csv') return readCsv(filePath)
  if (ext === '.xlsx' || ext === '.xls') return readXlsx(filePath, sheetName)
  if (ext === '.ods') return readOds(filePath, sheetName)

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

function readXlsx(filePath: string, sheetName?: string): { headers: string[]; rows: RawRow[] } {
  const wb = XLSX.readFile(filePath)
  const name = (sheetName && wb.SheetNames.includes(sheetName)) ? sheetName : wb.SheetNames[0]
  const ws = wb.Sheets[name]
  const data = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: false })
  const headers = data.length > 0 ? Object.keys(data[0]) : []
  return { headers, rows: data }
}

function readOds(filePath: string, sheetName?: string): { headers: string[]; rows: RawRow[] } {
  const wb = XLSX.readFile(filePath, { type: 'file' })
  const name = (sheetName && wb.SheetNames.includes(sheetName)) ? sheetName : wb.SheetNames[0]
  const ws = wb.Sheets[name]
  const data = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: false })
  const headers = data.length > 0 ? Object.keys(data[0]) : []
  return { headers, rows: data }
}
