import { useEffect, useState } from 'react'
import type { Sighting } from '../../../shared/types'

type Col = keyof Sighting
const COLS: Col[] = ['id', 'date', 'species', 'count', 'observer', 'locationId', 'notes']

export default function SightingsPage(): JSX.Element {
  const [rows, setRows] = useState<Sighting[]>([])
  const [filter, setFilter] = useState('')

  useEffect(() => {
    window.api.sightings.list().then(setRows)
  }, [])

  const filtered = filter
    ? rows.filter((r) =>
        COLS.some((c) => String(r[c] ?? '').toLowerCase().includes(filter.toLowerCase()))
      )
    : rows

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Sightings</h1>
      <input
        placeholder="Filter…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ padding: '6px 10px', fontSize: 14, marginBottom: 12, width: 280, border: '1px solid #ced4da', borderRadius: 4 }}
      />
      <p style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>{filtered.length} records</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>{COLS.map((c) => <th key={c} style={th}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
                {COLS.map((c) => <td key={c} style={td}>{String(row[c] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 10px', background: '#f1f3f5', border: '1px solid #dee2e6', textAlign: 'left' }
const td: React.CSSProperties = { padding: '5px 10px', border: '1px solid #dee2e6' }
