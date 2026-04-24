import { useRef, useState, useEffect } from 'react'
import jspreadsheet from 'jspreadsheet-ce'
import 'jspreadsheet-ce/dist/jspreadsheet.css'
import 'jsuites/dist/jsuites.css'
import type { RowFailure, FieldMapping } from '../../../shared/types'

export interface EditData {
  headers: string[]
  failures: RowFailure[]
  rows: Record<string, unknown>[]
  mapping: Partial<FieldMapping>
  filename: string
}

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

function buildStyle(rowCount: number, headerCount: number, failureMap: Map<number, string>) {
  const style: Record<string, string> = {}
  for (let r = 0; r < rowCount; r++) {
    const reason = failureMap.get(r)
    const rowBg = reason ? 'background-color: #fff5f5; ' : ''
    style[`A${r + 1}`] = reason
      ? 'background-color: #fff5f5; color: #c0392b; font-weight: bold;'
      : 'color: #2f9e44;'
    for (let c = 1; c <= headerCount; c++) {
      if (rowBg) style[`${colLetter(c)}${r + 1}`] = rowBg
    }
  }
  return style
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JssInstance = any

export default function EditPage({ editData, onSuccess, onCancel }: {
  editData: EditData
  onSuccess: (result: { imported: number; warnings: string[] }) => void
  onCancel: () => void
}): JSX.Element {
  const divRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<JssInstance>(null)
  const editedRowsRef = useRef<Record<string, unknown>[]>(editData.rows)
  const [failures, setFailures] = useState<RowFailure[]>(editData.failures)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<{ imported: number; warnings: string[] } | null>(null)
  const [initError, setInitError] = useState<string | null>(null)

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

    const w = window.innerWidth - 228   // 180 nav + 24*2 padding
    const h = window.innerHeight - 90

    const failureMap = new Map(failures.map(f => [f.index, f.reason]))
    const rows = editedRowsRef.current

    const data: string[][] = rows.map((row, i) => [
      failureMap.get(i) ?? '✓',
      ...editData.headers.map(h => String(row[h] ?? '')),
    ])

    const columns = [
      { type: 'text', title: 'Status', width: 260, readOnly: true },
      ...editData.headers.map(h => ({ type: 'text', title: h, width: 140 })),
    ]

    try {
      // v5 API: all worksheet options go inside the worksheets array
      instanceRef.current = jspreadsheet(el, {
        worksheets: [{
          data,
          columns,
          style: buildStyle(rows.length, editData.headers.length, failureMap),
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
  }, [failures]) // eslint-disable-line react-hooks/exhaustive-deps

  async function reimport() {
    const instance = instanceRef.current
    if (!instance) return

    // v5: getData() lives on the first worksheet
    const ws = Array.isArray(instance) ? instance[0] : (instance.worksheets?.[0] ?? instance)
    const rawData = ws.getData() as string[][]
    const editedRows: Record<string, unknown>[] = rawData.map(row => {
      const obj: Record<string, unknown> = {}
      editData.headers.forEach((h, i) => { obj[h] = row[i + 1] })  // skip status col
      return obj
    })
    editedRowsRef.current = editedRows

    setBusy(true)
    setError(null)
    try {
      const r = await window.api.import.commitRows(
        editedRows,
        editData.mapping as FieldMapping,
        editData.filename,
      )
      if (r.status === 'validation-failed') {
        setFailures(r.failures)
      } else {
        setSuccessResult({ imported: r.imported, warnings: r.warnings })
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
        {!successResult && failures.length > 0 && (
          <span style={{ color: '#c0392b', fontSize: 13 }}>
            <strong>{failures.length} row{failures.length !== 1 ? 's' : ''} need fixing.</strong>
            {' '}Edit cells then re-import.
          </span>
        )}
        {!successResult && failures.length === 0 && (
          <span style={{ color: '#555', fontSize: 13 }}>All rows valid — click Re-import to save.</span>
        )}
        {!successResult && (
          <button onClick={reimport} disabled={busy} style={{ ...btnPrimary, marginLeft: 'auto' }}>
            {busy ? 'Importing…' : 'Re-import'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: '#ffe3e3', borderRadius: 4, color: '#c0392b', fontSize: 13, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {successResult && (
        <div style={{ padding: '10px 14px', background: '#d3f9d8', borderRadius: 4, fontSize: 13, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
          <strong>{successResult.imported} sightings imported.</strong>
          {successResult.warnings.length > 0 && (
            <details><summary>{successResult.warnings.length} warnings</summary>
              <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                {successResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </details>
          )}
          <button onClick={() => onSuccess(successResult)} style={{ ...btnPrimary, marginLeft: 'auto', fontSize: 13 }}>
            Go to Sightings →
          </button>
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
