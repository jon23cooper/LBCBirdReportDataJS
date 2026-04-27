import { useEffect, useRef, useState } from 'react'
import type { Location } from '../../../shared/types'

export default function ExportPage(): JSX.Element {
  const [datasets, setDatasets] = useState<string[]>([])
  const [locationsList, setLocationsList] = useState<Location[]>([])
  const [filters, setFilters] = useState<ExportFilters>({})
  const [count, setCount] = useState<number | null>(null)
  const [busyXlsx, setBusyXlsx] = useState(false)
  const [busySql, setBusySql] = useState(false)
  const [result, setResult] = useState<{ path: string; format: string } | null>(null)
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.export.datasets().then(setDatasets)
    window.api.locations.list().then(setLocationsList)
  }, [])

  useEffect(() => {
    setCount(null)
    if (countTimer.current) clearTimeout(countTimer.current)
    countTimer.current = setTimeout(() => {
      window.api.export.count(filters).then(setCount)
    }, 300)
    return () => { if (countTimer.current) clearTimeout(countTimer.current) }
  }, [filters])

  function set(key: keyof ExportFilters, value: string | number | undefined) {
    setFilters(prev => {
      const next = { ...prev }
      if (value === '' || value === undefined) delete next[key]
      else (next as Record<string, unknown>)[key] = value
      return next
    })
  }

  function clearFilters() {
    setFilters({})
  }

  const hasFilters = Object.keys(filters).length > 0

  async function exportXlsx() {
    setBusyXlsx(true)
    setResult(null)
    try {
      const path = await window.api.export.xlsx(filters)
      if (path) setResult({ path, format: 'Excel' })
    } finally {
      setBusyXlsx(false)
    }
  }

  async function exportSql() {
    setBusySql(true)
    setResult(null)
    try {
      const path = await window.api.export.sql(filters)
      if (path) setResult({ path, format: 'SQL' })
    } finally {
      setBusySql(false)
    }
  }

  return (
    <div style={{ maxWidth: 620 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Export</h1>

      {/* Filter panel */}
      <div style={{ padding: 16, border: '1px solid #dee2e6', borderRadius: 6, background: '#fff', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Filters</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: count === null ? '#aaa' : '#333' }}>
              {count === null ? 'Counting…' : `${count.toLocaleString()} record${count === 1 ? '' : 's'}`}
            </span>
            {hasFilters && (
              <button onClick={clearFilters} style={btnSecondary}>Clear filters</button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
          <label style={labelStyle}>
            <span style={labelText}>Date from</span>
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={e => set('dateFrom', e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span style={labelText}>Date to</span>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={e => set('dateTo', e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelText}>Dataset</span>
            <select
              value={filters.dataset ?? ''}
              onChange={e => set('dataset', e.target.value)}
              style={inputStyle}
            >
              <option value="">(all)</option>
              {datasets.map(d => <option key={d} value={d!}>{d}</option>)}
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelText}>Location</span>
            <select
              value={filters.locationId ?? ''}
              onChange={e => set('locationId', e.target.value ? parseInt(e.target.value, 10) : undefined)}
              style={inputStyle}
            >
              <option value="">(all)</option>
              {locationsList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelText}>Species (partial)</span>
            <input
              type="text"
              value={filters.species ?? ''}
              onChange={e => set('species', e.target.value)}
              placeholder="e.g. Redshank"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelText}>Observer (partial)</span>
            <input
              type="text"
              value={filters.observer ?? ''}
              onChange={e => set('observer', e.target.value)}
              placeholder="e.g. MT"
              style={inputStyle}
            />
          </label>
        </div>
      </div>

      {/* Export buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={cardStyle}>
          <div>
            <h2 style={{ fontSize: 15, marginBottom: 4 }}>Excel spreadsheet</h2>
            <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
              Exports sightings as an <code>.xlsx</code> file with all fields including resolved location name.
            </p>
          </div>
          <button onClick={exportXlsx} disabled={busyXlsx || count === 0} style={btnPrimary}>
            {busyXlsx ? 'Exporting…' : 'Save Excel file…'}
          </button>
        </div>

        <div style={cardStyle}>
          <div>
            <h2 style={{ fontSize: 15, marginBottom: 4 }}>PostgreSQL SQL dump</h2>
            <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
              Exports sightings as a <code>.sql</code> file with <code>CREATE TABLE</code> and <code>INSERT</code> statements for PostgreSQL. All locations are always included.
            </p>
          </div>
          <button onClick={exportSql} disabled={busySql || count === 0} style={btnSecondary}>
            {busySql ? 'Exporting…' : 'Save SQL file…'}
          </button>
        </div>
      </div>

      {result && (
        <p style={{ fontSize: 13, color: '#2f9e44', marginTop: 12 }}>
          {result.format} saved to {result.path}
        </p>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 }
const labelText: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#555' }
const inputStyle: React.CSSProperties = { padding: '5px 8px', fontSize: 13, border: '1px solid #ced4da', borderRadius: 4, width: '100%', boxSizing: 'border-box' }
const cardStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 16, border: '1px solid #dee2e6', borderRadius: 6, background: '#fff' }
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#1c7ed6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }
const btnSecondary: React.CSSProperties = { padding: '7px 14px', background: '#f1f3f5', border: '1px solid #dee2e6', borderRadius: 4, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }
