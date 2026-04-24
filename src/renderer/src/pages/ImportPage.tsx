import { useState, useEffect } from 'react'
import type { FieldMapping } from '../../../shared/types'
import type { EditData } from './EditPage'

type FileInfo = { path: string; sheets: string[] }
type SheetData = { headers: string[]; preview: Record<string, unknown>[] }

const STANDARD_FIELDS: { key: keyof FieldMapping; label: string; required?: boolean }[] = [
  { key: 'species',                label: 'Species (common name)' },
  { key: 'date',                   label: 'First Date',                required: true },
  { key: 'originalCommonName',     label: 'Original Common Name',      required: true },
  { key: 'commonName',             label: 'Common Name (display)' },
  { key: 'originalScientificName', label: 'Original Scientific Name',  required: true },
  { key: 'scientificName',         label: 'Scientific Name' },
  { key: 'family',                 label: 'Family' },
  { key: 'subspeciesCommon',       label: 'Subspecies (common)' },
  { key: 'subspeciesScientific',   label: 'Subspecies (scientific)' },
  { key: 'locationName',           label: 'Location' },
  { key: 'originalLocation',       label: 'Original Location' },
  { key: 'lastDate',               label: 'Last Date' },
  { key: 'time',                   label: 'Start Time' },
  { key: 'endTime',                label: 'End Time' },
  { key: 'count',                  label: 'Total Count' },
  { key: 'originalCount',          label: 'Original Total Count' },
  { key: 'circa',                  label: 'Circa' },
  { key: 'observer',               label: 'Observers' },
  { key: 'notes',                  label: 'Notes' },
  { key: 'status',                 label: 'Status' },
  { key: 'age',                    label: 'Age' },
  { key: 'breedingCode',           label: 'Breeding code' },
  { key: 'breedingCategory',       label: 'Breeding category' },
  { key: 'behaviorCode',           label: 'Behavior code' },
  { key: 'tripMapRef',             label: 'Trip MapRef' },
  { key: 'lat',                    label: 'Latitude' },
  { key: 'lon',                    label: 'Longitude' },
  { key: 'uncertaintyRadius',      label: 'Uncertainty radius' },
  { key: 'geometryType',           label: 'Geometry type' },
  { key: 'occurrenceKey',          label: 'Occurrence Key' },
  { key: 'dataset',                label: 'Dataset' },
  { key: 'lbcId',                  label: 'LBC ID' },
]

function autoMap(headers: string[]): Record<string, string> {
  const matchers: { pattern: RegExp; field: string }[] = [
    { pattern: /^common.?name$/i,                 field: 'species' },
    { pattern: /^first.?date$/i,                  field: 'date' },
    { pattern: /^original.?common.?name$/i,       field: 'originalCommonName' },
    { pattern: /^original.?scientific.?name$/i,   field: 'originalScientificName' },
    { pattern: /^scientific.?name$/i,             field: 'scientificName' },
    { pattern: /^family$/i,                       field: 'family' },
    { pattern: /^subspecies.?common$/i,           field: 'subspeciesCommon' },
    { pattern: /^subspecies.?scientific$/i,       field: 'subspeciesScientific' },
    { pattern: /^location$/i,                     field: 'locationName' },
    { pattern: /^original.?location$/i,           field: 'originalLocation' },
    { pattern: /^last.?date$/i,                   field: 'lastDate' },
    { pattern: /^start.?time$/i,                  field: 'time' },
    { pattern: /^end.?time$/i,                    field: 'endTime' },
    { pattern: /^total.?count$/i,                 field: 'count' },
    { pattern: /^original.?total.?count$/i,       field: 'originalCount' },
    { pattern: /^circa$/i,                        field: 'circa' },
    { pattern: /^notes$/i,                        field: 'notes' },
    { pattern: /^observers?$/i,                   field: 'observer' },
    { pattern: /^status$/i,                       field: 'status' },
    { pattern: /^age$/i,                          field: 'age' },
    { pattern: /^breeding.?code$/i,               field: 'breedingCode' },
    { pattern: /^breeding.?categor/i,             field: 'breedingCategory' },
    { pattern: /^behav.*(code)?$/i,               field: 'behaviorCode' },
    { pattern: /^trip.?map.?ref$/i,               field: 'tripMapRef' },
    { pattern: /^lat(itude)?$/i,                  field: 'lat' },
    { pattern: /^lon(gitude)?$/i,                 field: 'lon' },
    { pattern: /^uncertainty/i,                   field: 'uncertaintyRadius' },
    { pattern: /^geometry.?type$/i,               field: 'geometryType' },
    { pattern: /^occurrence.?key$/i,              field: 'occurrenceKey' },
    { pattern: /^dataset$/i,                      field: 'dataset' },
    { pattern: /^lbc.?id$/i,                      field: 'lbcId' },
  ]
  const result: Record<string, string> = {}
  const usedFields = new Set<string>()
  for (const header of headers) {
    for (const { pattern, field } of matchers) {
      if (usedFields.has(field)) continue
      if (pattern.test(header)) { result[header] = field; usedFields.add(field); break }
    }
  }
  return result
}

function buildFieldMapping(columnMap: Record<string, string>): Partial<FieldMapping> {
  const fm: Partial<FieldMapping> = {}
  for (const [col, field] of Object.entries(columnMap)) {
    if (field) fm[field as keyof FieldMapping] = col
  }
  return fm
}

export default function ImportPage({ onValidationFailed }: {
  onValidationFailed: (data: EditData) => void
}): JSX.Element {
  const [file, setFile] = useState<FileInfo | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [skipRows, setSkipRows] = useState(0)
  const [sheetData, setSheetData] = useState<SheetData>({ headers: [], preview: [] })
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ imported: number; warnings: string[] } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    setBusy(true)
    window.api.import.readSheet(file.path, selectedSheet, skipRows)
      .then(data => {
        if (cancelled) return
        setSheetData({ headers: data.headers, preview: data.preview })
        setColumnMap(autoMap(data.headers))
        setResult(null)
        setBusy(false)
      })
      .catch(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [file, selectedSheet, skipRows])

  async function openFile(): Promise<void> {
    const info = await window.api.import.openFile()
    if (!info) return
    setSheetData({ headers: [], preview: [] })
    setColumnMap({})
    setResult(null)
    setSkipRows(0)
    setSelectedSheet(info.sheets[0] ?? '')
    setFile({ path: info.path, sheets: info.sheets })
  }

  async function commit(): Promise<void> {
    if (!file) return
    setBusy(true)
    setImportError(null)
    setResult(null)
    try {
      const mapping = buildFieldMapping(columnMap)
      const r = await window.api.import.commit(
        file.path, mapping as FieldMapping, selectedSheet || undefined, skipRows || undefined
      )
      if (r.status === 'validation-failed') {
        onValidationFailed({
          headers: r.headers,
          failures: r.failures,
          rows: r.allRows,
          mapping,
          filename: file.path.split('/').pop() ?? file.path,
        })
      } else {
        setResult({ imported: r.imported, warnings: r.warnings })
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const { headers, preview } = sheetData
  const assignedFields = new Set(Object.values(columnMap).filter(Boolean))
  const hasName = assignedFields.has('originalCommonName') || assignedFields.has('originalScientificName')
  const canCommit = assignedFields.has('date') && hasName

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={h1}>Import</h1>

      <button onClick={openFile} style={btnPrimary}>Choose file…</button>

      {file && (
        <>
          <p style={{ margin: '12px 0 4px', color: '#555', fontSize: 13 }}>
            {file.path} &mdash; {headers.length} columns
          </p>

          <div style={{ display: 'flex', gap: 24, alignItems: 'center', margin: '8px 0 12px', flexWrap: 'wrap' }}>
            {file.sheets.length > 1 && (
              <div>
                <label style={labelStyle}>Worksheet:</label>
                <select value={selectedSheet} onChange={(e) => setSelectedSheet(e.target.value)} style={{ fontSize: 13 }}>
                  {file.sheets.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Skip rows:</label>
              <input
                type="number" min={0} value={skipRows}
                onChange={(e) => setSkipRows(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{ width: 60, fontSize: 13, padding: '2px 4px' }}
              />
              <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>rows before the header</span>
            </div>
          </div>

          {busy ? (
            <p style={{ color: '#888', fontSize: 13 }}>Loading…</p>
          ) : (
            <>
              <h2 style={h2}>Map columns</h2>
              <p style={{ fontSize: 12, color: '#666', margin: '0 0 4px' }}>
                Columns auto-matched where names were recognised. Adjust any that are wrong, and set unmatched columns to the correct field or leave as (ignore).
              </p>
              <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px' }}>
                <span style={{ background: '#ffffff', border: '1px solid #dee2e6', padding: '1px 6px', marginRight: 6 }}>White</span> = mapped &nbsp;&nbsp;
                <span style={{ background: '#fffbf0', border: '1px solid #dee2e6', padding: '1px 6px', marginRight: 6 }}>Yellow</span> = not mapped (will be ignored)
              </p>
              <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th style={th}>Spreadsheet column</th>
                    <th style={th}>Standard field</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((col) => (
                    <tr key={col} style={{ background: columnMap[col] ? '#ffffff' : '#fffbf0' }}>
                      <td style={td}>{col}</td>
                      <td style={td}>
                        <select
                          value={columnMap[col] ?? ''}
                          onChange={(e) => setColumnMap({ ...columnMap, [col]: e.target.value })}
                          style={{ width: '100%', fontSize: 13 }}
                        >
                          <option value="">(ignore)</option>
                          {STANDARD_FIELDS.map(({ key, label, required }) => (
                            <option key={key as string} value={key as string}>
                              {label}{required ? ' ★' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!canCommit && (
                <p style={{ fontSize: 12, color: '#c0392b', marginBottom: 8 }}>
                  First Date ★ and at least one of Original Common Name ★ or Original Scientific Name ★ must be mapped before importing.
                </p>
              )}

              <h2 style={h2}>Preview (first 5 rows)</h2>
              <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>{headers.map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {headers.map((h) => <td key={h} style={td}>{String(row[h] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button onClick={commit} disabled={!canCommit || busy} style={btnPrimary}>
                {busy ? 'Importing…' : 'Import'}
              </button>
            </>
          )}
        </>
      )}

      {importError && (
        <div style={{ marginTop: 16, padding: 12, background: '#ffe3e3', borderRadius: 6, color: '#c0392b' }}>
          <strong>Import failed:</strong> {importError}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, padding: 12, background: '#d3f9d8', borderRadius: 6 }}>
          <strong>{result.imported} sightings imported.</strong>
          {result.warnings.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary>{result.warnings.length} warnings</summary>
              <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                {result.warnings.map((w, i) => <li key={i} style={{ fontSize: 12 }}>{w}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

const h1: React.CSSProperties = { fontSize: 22, marginBottom: 16 }
const h2: React.CSSProperties = { fontSize: 15, margin: '16px 0 8px' }
const labelStyle: React.CSSProperties = { fontSize: 13, marginRight: 6 }
const th: React.CSSProperties = { padding: '6px 10px', background: '#f1f3f5', border: '1px solid #dee2e6', textAlign: 'left', fontSize: 13 }
const td: React.CSSProperties = { padding: '5px 10px', border: '1px solid #dee2e6', fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#1c7ed6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }
