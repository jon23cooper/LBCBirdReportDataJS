import { useState, useEffect } from 'react'
import type { FieldMapping, StagingData } from '../../../shared/types'
import type { EditData } from './EditPage'

type FileInfo = { path: string; sheets: string[] }
type SheetData = { headers: string[]; preview: Record<string, unknown>[] }

const STANDARD_FIELDS: { key: keyof FieldMapping; label: string; required?: boolean }[] = [
  // Required fields first
  { key: 'date',                   label: 'First Date',                required: true },
  { key: 'originalCommonName',     label: 'Original Common Name',      required: true },
  { key: 'originalScientificName', label: 'Original Scientific Name',  required: true },
  { key: 'originalCount',          label: 'Original Total Count',      required: true },
  // Remaining fields alphabetically
  { key: 'age',                    label: 'Age' },
  { key: 'behaviorCode',           label: 'Behavior code' },
  { key: 'breedingCategory',       label: 'Breeding category' },
  { key: 'breedingCode',           label: 'Breeding code' },
  { key: 'circa',                  label: 'Circa' },
  { key: 'commonName',             label: 'Common Name (display)' },
  { key: 'dataset',                label: 'Dataset' },
  { key: 'endTime',                label: 'End Time' },
  { key: 'family',                 label: 'Family' },
  { key: 'geometryType',           label: 'Geometry type' },
  { key: 'lastDate',               label: 'Last Date' },
  { key: 'lat',                    label: 'Latitude' },
  { key: 'lbcId',                  label: 'LBC ID' },
  { key: 'locationName',           label: 'Location' },
  { key: 'lon',                    label: 'Longitude' },
  { key: 'notes',                  label: 'Notes' },
  { key: 'occurrenceKey',          label: 'Occurrence Key' },
  { key: 'originalLocation',       label: 'Original Location' },
  { key: 'observer',               label: 'Observers' },
  { key: 'scientificName',         label: 'Scientific Name' },
  { key: 'species',                label: 'Species (common name)' },
  { key: 'time',                   label: 'Start Time' },
  { key: 'status',                 label: 'Status' },
  { key: 'subspeciesCommon',       label: 'Subspecies (common)' },
  { key: 'subspeciesScientific',   label: 'Subspecies (scientific)' },
  { key: 'count',                  label: 'Total Count' },
  { key: 'tripMapRef',             label: 'Trip MapRef' },
  { key: 'uncertaintyRadius',      label: 'Uncertainty radius' },
]

function autoMap(headers: string[]): Record<string, string> {
  const matchers: { pattern: RegExp; field: string }[] = [
    // Species
    { pattern: /^species.?common.?name$/i,        field: 'originalCommonName' },
    { pattern: /^original.?common.?name$/i,       field: 'originalCommonName' },
    { pattern: /^common.?name$/i,                 field: 'species' },
    { pattern: /^original.?scientific.?name$/i,   field: 'originalScientificName' },
    { pattern: /^scientific.?name$/i,             field: 'scientificName' },
    { pattern: /^family$/i,                       field: 'family' },
    { pattern: /^subspecies.?common$/i,           field: 'subspeciesCommon' },
    { pattern: /^subspecies.?scientific$/i,       field: 'subspeciesScientific' },
    // Dates / times
    { pattern: /^first.?date/i,                   field: 'date' },
    { pattern: /^last.?date/i,                    field: 'lastDate' },
    { pattern: /^start.?time$/i,                  field: 'time' },
    { pattern: /^end.?time$/i,                    field: 'endTime' },
    // Location — "Location" alone is treated as a raw string needing matching;
    // "Location Name" / "Site Name" is a pre-resolved exact name
    { pattern: /^location.?name$/i,               field: 'locationName' },
    { pattern: /^site.?name$/i,                   field: 'locationName' },
    { pattern: /^original.?location$/i,           field: 'originalLocation' },
    { pattern: /^location$/i,                     field: 'originalLocation' },
    // Count
    { pattern: /^original.?total.?count$/i,       field: 'originalCount' },
    { pattern: /^total.?count$/i,                 field: 'count' },
    { pattern: /^number$/i,                       field: 'originalCount' },
    { pattern: /^circa$/i,                        field: 'circa' },
    // Observation detail
    { pattern: /^age.*(sex|code)/i,               field: 'age' },
    { pattern: /^age$/i,                          field: 'age' },
    { pattern: /^status$/i,                       field: 'status' },
    { pattern: /^breeding.?code$/i,               field: 'breedingCode' },
    { pattern: /^breeding.?categor/i,             field: 'breedingCategory' },
    { pattern: /^behav.*(code)?$/i,               field: 'behaviorCode' },
    // Observer / notes
    { pattern: /^observers?.?initials?$/i,        field: 'observer' },
    { pattern: /^observers?$/i,                   field: 'observer' },
    { pattern: /^notes/i,                         field: 'notes' },
    // Spatial
    { pattern: /^lat(itude)?$/i,                  field: 'lat' },
    { pattern: /^lon(gitude)?$/i,                 field: 'lon' },
    { pattern: /^uncertainty/i,                   field: 'uncertaintyRadius' },
    { pattern: /^geometry.?type$/i,               field: 'geometryType' },
    { pattern: /^trip.?map.?ref$/i,               field: 'tripMapRef' },
    // Reference
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

export default function ImportPage({ onValidationFailed, onValidated }: {
  onValidationFailed: (data: EditData) => void
  onValidated: (data: StagingData) => void
}): JSX.Element {
  const [file, setFile] = useState<FileInfo | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [skipRows, setSkipRows] = useState(0)
  const [sheetData, setSheetData] = useState<SheetData>({ headers: [], preview: [] })
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [dataset, setDataset] = useState('')
  const [defaultObserver, setDefaultObserver] = useState('')
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
    setSkipRows(0)
    setSelectedSheet(info.sheets[0] ?? '')
    setFile({ path: info.path, sheets: info.sheets })
  }

  async function commit(): Promise<void> {
    if (!file) return
    setBusy(true)
    setImportError(null)
    try {
      const mapping = buildFieldMapping(columnMap)
      const batchOptions = { dataset: dataset.trim() || undefined, defaultObserver: defaultObserver.trim() || undefined }
      const filename = file.path.split('/').pop() ?? file.path
      const format = file.path.split('.').pop() ?? ''
      const r = await window.api.import.validate(
        file.path, mapping as FieldMapping, selectedSheet || undefined, skipRows || undefined, batchOptions
      )
      if (r.status === 'validation-failed') {
        onValidationFailed({ headers: r.headers, failures: r.failures, rows: r.allRows, mapping, filename, filePath: file.path, batchOptions })
      } else {
        onValidated({ rows: r.rows, warnings: r.warnings, filename, filePath: file.path, format, mapping, batchOptions })
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
  const observerMapped = assignedFields.has('observer')
  const canCommit = assignedFields.has('date') && hasName && assignedFields.has('originalCount') && !!dataset.trim() && (observerMapped || !!defaultObserver.trim())

  return (
    <div>
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
              <table style={{ borderCollapse: 'collapse', marginBottom: 16 }}>
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

              <h2 style={h2}>Preview (first 5 rows)</h2>
              <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
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

              <h2 style={h2}>Batch details</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ ...labelStyle, width: 120, flexShrink: 0 }}>Dataset <span style={{ color: '#c0392b' }}>★</span></label>
                  <input
                    type="text"
                    value={dataset}
                    onChange={e => setDataset(e.target.value)}
                    placeholder="e.g. LBC 2024"
                    style={{ fontSize: 13, padding: '4px 8px', width: 260 }}
                  />
                </div>
                {!observerMapped && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ ...labelStyle, width: 120, flexShrink: 0 }}>Default observer <span style={{ color: '#c0392b' }}>★</span></label>
                    <input
                      type="text"
                      value={defaultObserver}
                      onChange={e => setDefaultObserver(e.target.value)}
                      placeholder="Name applied to all rows"
                      style={{ fontSize: 13, padding: '4px 8px', width: 260 }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <button
                  onClick={commit}
                  disabled={!canCommit || busy}
                  style={canCommit ? btnPrimary : btnDisabled}
                >
                  {busy ? 'Importing…' : 'Import'}
                </button>
                {!canCommit && (
                  <span style={{ fontSize: 13, color: '#c0392b' }}>
                    {!dataset.trim() ? 'Enter a dataset name. ' : ''}
                    {!observerMapped && !defaultObserver.trim() ? 'Enter a default observer (no observer column mapped). ' : ''}
                    {(assignedFields.size === 0 || !assignedFields.has('date') || !hasName || !assignedFields.has('originalCount')) ? 'Map the required fields (★) above.' : ''}
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      {importError && (
        <div style={{ marginTop: 16, padding: 12, background: '#ffe3e3', borderRadius: 6, color: '#c0392b' }}>
          <strong>Import failed:</strong> {importError}
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
const btnDisabled: React.CSSProperties = { padding: '8px 16px', background: '#adb5bd', color: '#fff', border: 'none', borderRadius: 4, cursor: 'not-allowed', fontSize: 14 }
