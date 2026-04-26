import { useEffect, useState } from 'react'
import type { Sighting } from '../../../shared/types'

type Col = keyof Sighting

const COLS: { key: Col; label: string }[] = [
  { key: 'lbcId',                 label: 'LBC ID' },
  { key: 'date',                  label: 'First Date' },
  { key: 'lastDate',              label: 'Last Date' },
  { key: 'dataset',               label: 'Dataset' },
  { key: 'originalCommonName',    label: 'Original Common Name' },
  { key: 'commonName',            label: 'Common Name (display)' },
  { key: 'originalScientificName',label: 'Original Scientific Name' },
  { key: 'scientificName',        label: 'Scientific Name' },
  { key: 'family',                label: 'Family' },
  { key: 'subspeciesCommon',      label: 'Subspecies (common)' },
  { key: 'subspeciesScientific',  label: 'Subspecies (scientific)' },
  { key: 'originalCount',         label: 'Original Total Count' },
  { key: 'count',                 label: 'Total Count' },
  { key: 'circa',                 label: 'Circa' },
  { key: 'age',                   label: 'Age' },
  { key: 'status',                label: 'Status' },
  { key: 'breedingCode',          label: 'Breeding Code' },
  { key: 'breedingCategory',      label: 'Breeding Category' },
  { key: 'observer',              label: 'Observers' },
  { key: 'originalLocation',      label: 'Original Location' },
  { key: 'locationMatchName',     label: 'Resolved Location' },
  { key: 'time',                  label: 'Start Time' },
  { key: 'endTime',               label: 'End Time' },
  { key: 'notes',                 label: 'Notes' },
]

interface BatchInfo {
  id: number
  filename: string
  storedFile: string | null
}

export default function SightingsPage(): JSX.Element {
  const [rows, setRows] = useState<Sighting[]>([])
  const [batches, setBatches] = useState<Map<number, BatchInfo>>(new Map())
  const [filter, setFilter] = useState('')
  const [batchFilter, setBatchFilter] = useState<number | null>(null)

  useEffect(() => {
    window.api.sightings.list().then(setRows)
    window.api.batches.list().then(list => {
      setBatches(new Map(list.map(b => [b.id, { id: b.id, filename: b.filename, storedFile: b.storedFile }])))
    })
  }, [])

  const visibleCols = COLS.filter(({ key }) => rows.some(r => r[key] != null && r[key] !== ''))

  const batchFiltered = batchFilter != null ? rows.filter(r => r.importBatchId === batchFilter) : rows

  const filtered = filter
    ? batchFiltered.filter((r) =>
        visibleCols.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(filter.toLowerCase()))
      )
    : batchFiltered

  const activeBatch = batchFilter != null ? batches.get(batchFilter) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Sightings</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 14, width: 280, border: '1px solid #ced4da', borderRadius: 4 }}
        />
        <span style={{ fontSize: 13, color: '#555' }}>{filtered.length} of {rows.length} records</span>
      </div>

      {activeBatch && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: '#e7f5ff', border: '1px solid #74c0fc', borderRadius: 4, fontSize: 13 }}>
          <span>Filtered to <strong>{activeBatch.filename}</strong> ({batchFiltered.length} records)</span>
          {activeBatch.storedFile && (
            <>
              <button onClick={() => window.api.batches.openFile(activeBatch.storedFile!)} style={btnSmall}>Open</button>
              <button onClick={() => window.api.batches.revealFile(activeBatch.storedFile!)} style={btnSmall}>Reveal in Finder</button>
            </>
          )}
          <button onClick={() => setBatchFilter(null)} style={btnSmall}>Show all</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th style={th}>Source file</th>
              {visibleCols.map(({ key, label }) => <th key={key} style={th}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const batch = row.importBatchId != null ? batches.get(row.importBatchId) : undefined
              return (
                <tr key={i} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
                  <td style={td}>
                    {batch ? (
                      <button
                        onClick={() => setBatchFilter(batch.id)}
                        title={`Filter to all records from ${batch.filename}`}
                        style={{ ...btnSmall, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
                      >
                        {batch.filename}
                      </button>
                    ) : '—'}
                  </td>
                  {visibleCols.map(({ key }) => <td key={key} style={td}>{String(row[key] ?? '')}</td>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 10px', background: '#f1f3f5', border: '1px solid #dee2e6', textAlign: 'left', position: 'sticky', top: 0 }
const td: React.CSSProperties = { padding: '5px 10px', border: '1px solid #dee2e6' }
const btnSmall: React.CSSProperties = { padding: '3px 8px', background: '#e9ecef', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 }
