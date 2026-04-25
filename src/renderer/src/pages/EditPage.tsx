import { useRef, useState, useEffect, useMemo } from 'react'
import jspreadsheet from 'jspreadsheet-ce'
import 'jspreadsheet-ce/dist/jspreadsheet.css'
import 'jsuites/dist/jsuites.css'
import type { RowFailure, FieldMapping, BatchOptions, StagingData } from '../../../shared/types'

export interface EditData {
  headers: string[]
  failures: RowFailure[]
  rows: Record<string, unknown>[]
  mapping: Partial<FieldMapping>
  filename: string
  filePath?: string
  batchOptions: BatchOptions
}

// Friendly labels matching ImportPage STANDARD_FIELDS order
const FIELD_LABELS: Record<string, string> = {
  date:                   'First Date',
  originalCommonName:     'Original Common Name',
  originalScientificName: 'Original Scientific Name',
  originalCount:          'Original Total Count',
  age:                    'Age',
  behaviorCode:           'Behavior code',
  breedingCategory:       'Breeding category',
  breedingCode:           'Breeding code',
  circa:                  'Circa',
  commonName:             'Common Name (display)',
  dataset:                'Dataset',
  endTime:                'End Time',
  family:                 'Family',
  geometryType:           'Geometry type',
  lastDate:               'Last Date',
  lat:                    'Latitude',
  lbcId:                  'LBC ID',
  locationName:           'Location',
  lon:                    'Longitude',
  notes:                  'Notes',
  occurrenceKey:          'Occurrence Key',
  originalLocation:       'Original Location',
  observer:               'Observers',
  scientificName:         'Scientific Name',
  species:                'Species (common name)',
  time:                   'Start Time',
  status:                 'Status',
  subspeciesCommon:       'Subspecies (common)',
  subspeciesScientific:   'Subspecies (scientific)',
  count:                  'Total Count',
  tripMapRef:             'Trip MapRef',
  uncertaintyRadius:      'Uncertainty radius',
}

// Stable order: required fields first, then the rest as defined in FIELD_LABELS
const FIELD_ORDER = Object.keys(FIELD_LABELS)

// Convert 0-based column index to spreadsheet letter (A, B, … Z, AA, AB, …)
function colLetter(n: number): string {
  let s = ''
  let i = n + 1
  while (i > 0) {
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

function buildStyle(rowCount: number, colCount: number, failureMap: Map<number, string>) {
  const style: Record<string, string> = {}
  for (let r = 0; r < rowCount; r++) {
    const reason = failureMap.get(r)
    const rowBg = reason ? 'background-color: #fff5f5; ' : ''
    style[`A${r + 1}`] = reason
      ? 'background-color: #fff5f5; color: #c0392b; font-weight: bold;'
      : 'color: #2f9e44;'
    for (let c = 1; c <= colCount; c++) {
      if (rowBg) style[`${colLetter(c)}${r + 1}`] = rowBg
    }
  }
  return style
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JssInstance = any

export default function EditPage({ editData, onValidated, onCancel }: {
  editData: EditData
  onValidated: (data: StagingData) => void
  onCancel: () => void
}): JSX.Element {
  const divRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<JssInstance>(null)
  const editedRowsRef = useRef<Record<string, unknown>[]>(editData.rows)
  const [failures, setFailures] = useState<RowFailure[]>(editData.failures)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [extraFieldKeys, setExtraFieldKeys] = useState<string[]>([])
  const [addColFieldKey, setAddColFieldKey] = useState('')

  // Fields already in mapping
  const mappedFieldKeys = useMemo(
    () => new Set(FIELD_ORDER.filter(k => editData.mapping[k as keyof FieldMapping])),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Fields available to add (not mapped, not already added as extra)
  const availableToAdd = useMemo(
    () => FIELD_ORDER.filter(k => !mappedFieldKeys.has(k) && !extraFieldKeys.includes(k)),
    [mappedFieldKeys, extraFieldKeys]
  )

  // Derive display columns from mapping + extra fields, in FIELD_ORDER sequence
  const displayCols = useMemo(() => [
    ...FIELD_ORDER
      .filter(fieldKey => editData.mapping[fieldKey as keyof FieldMapping])
      .map(fieldKey => ({
        fieldKey,
        label: FIELD_LABELS[fieldKey] ?? fieldKey,
        sourceCol: editData.mapping[fieldKey as keyof FieldMapping] as string,
        isExtra: false,
      })),
    ...extraFieldKeys.map(fieldKey => ({
      fieldKey,
      label: FIELD_LABELS[fieldKey] ?? fieldKey,
      sourceCol: fieldKey,
      isExtra: true,
    })),
  ], [extraFieldKeys]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save current sheet state back into editedRowsRef before re-initialising
  function saveCurrentState() {
    const instance = instanceRef.current
    if (!instance) return
    const ws = Array.isArray(instance) ? instance[0] : (instance.worksheets?.[0] ?? instance)
    const rawData = ws.getData() as string[][]
    editedRowsRef.current = rawData.map(row => {
      const obj: Record<string, unknown> = {}
      displayCols.forEach(({ sourceCol }, i) => { obj[sourceCol] = row[i + 1] })
      return obj
    })
  }

  function addExtraColumn() {
    if (!addColFieldKey) return
    saveCurrentState()
    setExtraFieldKeys(prev => [...prev, addColFieldKey])
    setAddColFieldKey('')
  }

  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const instance = instanceRef.current
        if (!instance) return
        const ws = Array.isArray(instance) ? instance[0] : (instance.worksheets?.[0] ?? instance)
        const w = window.innerWidth - 228
        const h = window.innerHeight - 90
        if (ws?.content) {
          ws.content.style.width = `${w}px`
          ws.content.style.maxHeight = `${h}px`
        }
      }, 100)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [])

  useEffect(() => {
    const el = divRef.current
    if (!el) return

    const w = window.innerWidth - 228
    const h = window.innerHeight - 90

    const failureMap = new Map(failures.map(f => [f.index, f.reason]))
    const rows = editedRowsRef.current

    const data: string[][] = rows.map((row, i) => [
      failureMap.get(i) ?? '✓',
      ...displayCols.map(({ sourceCol }) => String(row[sourceCol] ?? '')),
    ])

    const columns = [
      { type: 'text', title: 'Status', width: 260, readOnly: true },
      ...displayCols.map(({ label }) => ({ type: 'text', title: label, width: 160 })),
    ]

    try {
      instanceRef.current = jspreadsheet(el, {
        worksheets: [{
          data,
          columns,
          style: buildStyle(rows.length, displayCols.length, failureMap),
          tableOverflow: true,
          tableWidth: `${w}px`,
          tableHeight: `${h}px`,
          allowDeleteRow: true,
          allowInsertRow: false,
          allowDeleteColumn: false,
          allowInsertColumn: false,
          columnSorting: false,
        }],
      })
      setInitError(null)
    } catch (err) {
      setInitError(err instanceof Error ? err.message : String(err))
    }

    return () => {
      if (instanceRef.current && divRef.current) {
        try { jspreadsheet.destroy(divRef.current, false) } catch {}
        divRef.current.innerHTML = ''
      }
      instanceRef.current = null
    }
  }, [failures, extraFieldKeys]) // eslint-disable-line react-hooks/exhaustive-deps

  async function reimport() {
    const instance = instanceRef.current
    if (!instance) return

    const ws = Array.isArray(instance) ? instance[0] : (instance.worksheets?.[0] ?? instance)
    const rawData = ws.getData() as string[][]
    const editedRows: Record<string, unknown>[] = rawData.map(row => {
      const obj: Record<string, unknown> = {}
      displayCols.forEach(({ sourceCol }, i) => { obj[sourceCol] = row[i + 1] })
      return obj
    })
    editedRowsRef.current = editedRows

    // Extend mapping with extra field keys mapped to themselves
    const extendedMapping: Partial<FieldMapping> = { ...editData.mapping }
    for (const fieldKey of extraFieldKeys) {
      (extendedMapping as Record<string, string>)[fieldKey] = fieldKey
    }

    setBusy(true)
    setError(null)
    try {
      const r = await window.api.import.validateRows(
        editedRows,
        extendedMapping as FieldMapping,
        editData.batchOptions,
      )
      if (r.status === 'validation-failed') {
        setFailures(r.failures)
      } else {
        onValidated({
          rows: r.rows,
          warnings: r.warnings,
          filename: editData.filename,
          format: 'edited',
          mapping: extendedMapping,
          batchOptions: editData.batchOptions,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={onCancel} style={btnSecondary}>← Back</button>
        {editData.filePath && (
          <button onClick={() => window.api.batches.openFile(editData.filePath!)} style={btnSecondary}>Open source file</button>
        )}
        {failures.length > 0 && (
          <span style={{ color: '#c0392b', fontSize: 13 }}>
            <strong>{failures.length} row{failures.length !== 1 ? 's' : ''} need fixing.</strong>
            {' '}Edit cells then re-import.
          </span>
        )}
        {failures.length === 0 && (
          <span style={{ color: '#555', fontSize: 13 }}>All rows valid — click Re-import to save.</span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          {availableToAdd.length > 0 && (
            <>
              <select
                value={addColFieldKey}
                onChange={e => setAddColFieldKey(e.target.value)}
                style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #ced4da', borderRadius: 4, background: '#fff' }}
              >
                <option value="">Add column…</option>
                {availableToAdd.map(k => (
                  <option key={k} value={k}>{FIELD_LABELS[k] ?? k}</option>
                ))}
              </select>
              <button
                onClick={addExtraColumn}
                disabled={!addColFieldKey}
                style={btnSecondary}
              >
                + Add
              </button>
            </>
          )}
          <button onClick={reimport} disabled={busy} style={btnPrimary}>
            {busy ? 'Validating…' : 'Re-import'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: '#ffe3e3', borderRadius: 4, color: '#c0392b', fontSize: 13, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {initError && (
        <div style={{ padding: '8px 12px', background: '#ffe3e3', borderRadius: 4, color: '#c0392b', fontSize: 13, flexShrink: 0 }}>
          Spreadsheet error: {initError}
        </div>
      )}
      <div ref={divRef} style={{ width: '100%', height: 'calc(100vh - 90px)', overflow: 'hidden' }} />
    </div>
  )
}

const btnPrimary: React.CSSProperties = { padding: '7px 16px', background: '#1c7ed6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }
const btnSecondary: React.CSSProperties = { padding: '7px 12px', background: '#f1f3f5', border: '1px solid #dee2e6', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
