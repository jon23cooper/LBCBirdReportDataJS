import { useEffect, useState } from 'react'
import type { Location } from '../../../shared/types'

const EMPTY: Location = { name: '', gridRef: '', lat: undefined, lon: undefined, country: '', region: '', notes: '' }

export default function LocationsPage(): JSX.Element {
  const [locations, setLocations] = useState<Location[]>([])
  const [editing, setEditing] = useState<Location | null>(null)

  async function load(): Promise<void> {
    const rows = await window.api.locations.list()
    setLocations(rows)
  }

  useEffect(() => { load() }, [])

  async function save(): Promise<void> {
    if (!editing) return
    await window.api.locations.upsert(editing)
    setEditing(null)
    await load()
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Locations</h1>
      <button onClick={() => setEditing({ ...EMPTY })} style={btnPrimary}>Add location</button>

      {editing && (
        <div style={{ margin: '16px 0', padding: 16, border: '1px solid #ced4da', borderRadius: 6, background: '#fff' }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>{editing.id ? 'Edit' : 'New'} location</h2>
          {(['name', 'gridRef', 'country', 'region', 'notes'] as const).map((field) => (
            <label key={field} style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
              {field}
              <input
                value={(editing[field] as string) ?? ''}
                onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '5px 8px', border: '1px solid #ced4da', borderRadius: 4, marginTop: 2 }}
              />
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['lat', 'lon'] as const).map((field) => (
              <label key={field} style={{ flex: 1, fontSize: 13 }}>
                {field}
                <input
                  type="number"
                  step="any"
                  value={editing[field] ?? ''}
                  onChange={(e) => setEditing({ ...editing, [field]: e.target.value ? parseFloat(e.target.value) : undefined })}
                  style={{ display: 'block', width: '100%', padding: '5px 8px', border: '1px solid #ced4da', borderRadius: 4, marginTop: 2 }}
                />
              </label>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={save} style={btnPrimary}>Save</button>
            <button onClick={() => setEditing(null)} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12, fontSize: 13 }}>
        <thead>
          <tr>{['Name', 'Grid ref', 'Lat', 'Lon', 'Country', 'Region', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {locations.map((loc, i) => (
            <tr key={i} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
              <td style={td}>{loc.name}</td>
              <td style={td}>{loc.gridRef}</td>
              <td style={td}>{loc.lat}</td>
              <td style={td}>{loc.lon}</td>
              <td style={td}>{loc.country}</td>
              <td style={td}>{loc.region}</td>
              <td style={td}>
                <button onClick={() => setEditing({ ...loc })} style={btnSmall}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 10px', background: '#f1f3f5', border: '1px solid #dee2e6', textAlign: 'left' }
const td: React.CSSProperties = { padding: '5px 10px', border: '1px solid #dee2e6' }
const btnPrimary: React.CSSProperties = { padding: '7px 14px', background: '#1c7ed6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
const btnSecondary: React.CSSProperties = { padding: '7px 14px', background: '#f1f3f5', color: '#1a1a1a', border: '1px solid #ced4da', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
const btnSmall: React.CSSProperties = { padding: '3px 8px', background: '#e9ecef', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 }
