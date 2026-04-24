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
  { key: 'time',                  label: 'Start Time' },
  { key: 'endTime',               label: 'End Time' },
  { key: 'notes',                 label: 'Notes' },
]

export default function SightingsPage(): JSX.Element {
  const [rows, setRows] = useState<Sighting[]>([])
  const [filter, setFilter] = useState('')

  useEffect(() => {
    window.api.sightings.list().then(setRows)
  }, [])

  const visibleCols = COLS.filter(({ key }) => rows.some(r => r[key] != null && r[key] !== ''))

  const filtered = filter
    ? rows.filter((r) =>
        visibleCols.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(filter.toLowerCase()))
      )
    : rows

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Sightings</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 14, width: 280, border: '1px solid #ced4da', borderRadius: 4 }}
        />
        <span style={{ fontSize: 13, color: '#555' }}>{filtered.length} of {rows.length} records</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
          <thead>
            <tr>{visibleCols.map(({ key, label }) => <th key={key} style={th}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
                {visibleCols.map(({ key }) => <td key={key} style={td}>{String(row[key] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 10px', background: '#f1f3f5', border: '1px solid #dee2e6', textAlign: 'left', position: 'sticky', top: 0 }
const td: React.CSSProperties = { padding: '5px 10px', border: '1px solid #dee2e6' }
