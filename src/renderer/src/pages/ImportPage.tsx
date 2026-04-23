import { useState, useRef } from 'react'
import type { FieldMapping } from '../../../shared/types'

type FileInfo = { path: string; sheets: string[] }
type SheetData = { headers: string[]; preview: Record<string, unknown>[] }

const STANDARD_FIELDS: { key: keyof FieldMapping; label: string; required: boolean }[] = [
  { key: 'species', label: 'Species', required: true },
  { key: 'date', label: 'Date', required: true },
  { key: 'count', label: 'Count', required: false },
  { key: 'locationName', label: 'Location name', required: false },
  { key: 'lat', label: 'Latitude', required: false },
  { key: 'lon', label: 'Longitude', required: false },
  { key: 'observer', label: 'Observer', required: false },
  { key: 'notes', label: 'Notes', required: false }
]

export default function ImportPage(): JSX.Element {
  const [file, setFile] = useState<FileInfo | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [skipRows, setSkipRows] = useState(0)
  const [sheetData, setSheetData] = useState<SheetData>({ headers: [], preview: [] })
  const [mapping, setMapping] = useState<Partial<FieldMapping>>({})
  const [result, setResult] = useState<{ imported: number; warnings: string[] } | null>(null)
  const [busy, setBusy] = useState(false)

  // Incremented on every new file open or reload; stale async callbacks check this before writing state
  const reloadToken = useRef(0)

  async function openFile(): Promise<void> {
    const info = await window.api.import.openFile()
    if (!info) return
    reloadToken.current += 1
    setFile({ path: info.path, sheets: info.sheets })
    setSelectedSheet(info.sheets[0] ?? '')
    setSkipRows(0)
    setSheetData({ headers: info.headers, preview: info.preview })
    setMapping({})
    setResult(null)
  }

  async function reload(sheet: string, skip: number): Promise<void> {
    if (!file) return
    const token = reloadToken.current
    setBusy(true)
    try {
      const data = await window.api.import.readSheet(file.path, sheet, skip)
      if (reloadToken.current !== token) return
      setSheetData({ headers: data.headers, preview: data.preview })
      setMapping({})
      setResult(null)
    } finally {
      if (reloadToken.current === token) setBusy(false)
    }
  }

  function handleSheetChange(name: string): void {
    reloadToken.current += 1
    setSelectedSheet(name)
    reload(name, skipRows)
  }

  function handleSkipRows(value: number): void {
    const n = Math.max(0, value)
    reloadToken.current += 1
    setSkipRows(n)
    reload(selectedSheet, n)
  }

  async function commit(): Promise<void> {
    if (!file) return
    setBusy(true)
    try {
      const r = await window.api.import.commit(
        file.path,
        mapping as FieldMapping,
        selectedSheet || undefined,
        skipRows || undefined
      )
      setResult(r)
    } finally {
      setBusy(false)
    }
  }

  const { headers, preview } = sheetData
  const canCommit = mapping.species && mapping.date

  return (
    <div style={{ maxWidth: 760 }}>
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
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  {file.sheets.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Skip rows:</label>
              <input
                type="number"
                min={0}
                value={skipRows}
                onChange={(e) => handleSkipRows(parseInt(e.target.value, 10) || 0)}
                style={{ width: 60, fontSize: 13, padding: '2px 4px' }}
              />
              <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>rows before the header</span>
            </div>
          </div>

          <h2 style={h2}>Map columns</h2>
          <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={th}>Standard field</th>
                <th style={th}>Source column</th>
              </tr>
            </thead>
            <tbody>
              {STANDARD_FIELDS.map(({ key, label, required }) => (
                <tr key={key}>
                  <td style={td}>{label}{required && <span style={{ color: 'red' }}> *</span>}</td>
                  <td style={td}>
                    <select
                      value={mapping[key] ?? ''}
                      onChange={(e) => setMapping({ ...mapping, [key]: e.target.value || undefined })}
                      style={{ width: '100%' }}
                    >
                      <option value="">(none)</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={h2}>Preview (first 5 rows)</h2>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{headers.map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h} style={td}>{String(row[h] ?? '')}</td>
                    ))}
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
