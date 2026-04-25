import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import type * as GeoJSON from 'geojson'
import type { Location, LocationRegexRow } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Leaflet map with optional polygon editing via geoman
// Use key={location.id ?? 'new'} to re-mount when switching locations.
// ---------------------------------------------------------------------------
function LocationMap({ initialGeometry, editMode, onGeometryChange, currentLocationId }: {
  initialGeometry: string | null | undefined
  editMode: boolean
  onGeometryChange: (geom: string, centroidLat: number, centroidLon: number) => void
  currentLocationId?: number
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const polygonRef = useRef<L.Polygon | null>(null)

  // Initialise map and polygon once on mount
  useEffect(() => {
    if (!containerRef.current) return

    const map = L.map(containerRef.current, { zoomControl: true })
    L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map)
    mapRef.current = map

    // Render the current location's polygon first so we know where to fit bounds
    let poly: L.Polygon | null = null
    if (initialGeometry) {
      try {
        const geom = JSON.parse(initialGeometry)
        const ring = (geom.coordinates[0] as number[][]).map(([lon, lat]) => L.latLng(lat, lon))
        poly = L.polygon(ring, { color: '#1c7ed6', fillColor: '#74c0fc', fillOpacity: 0.3, weight: 2 })
        poly.addTo(map)
        polygonRef.current = poly
        map.fitBounds(poly.getBounds(), { padding: [24, 24] })
      } catch { map.setView([53.1, -0.4], 10) }
    } else {
      map.setView([53.1, -0.4], 10)
    }

    // Load and render neighbour polygons asynchronously so they don't block the main polygon
    window.api.locations.listGeometries().then(rows => {
      if (!mapRef.current) return
      const features = rows
        .filter(r => r.id !== currentLocationId)
        .map(r => {
          try { return { type: 'Feature' as const, properties: { name: r.name }, geometry: JSON.parse(r.geometry) } }
          catch { return null }
        })
        .filter((f): f is GeoJSON.Feature => f !== null)
      if (features.length > 0) {
        try {
          L.geoJSON({ type: 'FeatureCollection', features }, {
            style: { color: '#868e96', fillColor: '#dee2e6', fillOpacity: 0.15, weight: 1 },
            onEachFeature: (feature, layer) => {
              if (feature.properties?.name) {
                layer.bindTooltip(feature.properties.name as string, { sticky: true, opacity: 0.9 })
              }
            }
          }).addTo(map)
          polygonRef.current?.bringToFront()
        } catch { /* ignore neighbour render errors */ }
      }
    }).catch(() => { /* neighbours are optional */ })

    return () => {
      try { map.remove() } catch { /* Leaflet SVG cleanup can throw when React removes the container first */ }
      mapRef.current = null
      polygonRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle geoman editing when editMode changes
  useEffect(() => {
    const poly = polygonRef.current
    const map = mapRef.current
    if (!poly || !map) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pm = (poly as any).pm

    if (editMode) {
      pm.enable({ allowSelfIntersection: false })
      poly.on('pm:edit', () => {
        const lls = poly.getLatLngs()[0] as L.LatLng[]
        const coords = lls.map(ll => [ll.lng, ll.lat] as number[])
        coords.push(coords[0]) // close ring
        const n = lls.length
        onGeometryChange(
          JSON.stringify({ type: 'Polygon', coordinates: [coords] }),
          lls.reduce((s, ll) => s + ll.lat, 0) / n,
          lls.reduce((s, ll) => s + ll.lng, 0) / n,
        )
      })
    } else {
      pm.disable()
      poly.off('pm:edit')
    }
  }, [editMode]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ height: 380, width: '100%', borderRadius: 4, border: '1px solid #dee2e6' }} />
}

// ---------------------------------------------------------------------------
// Regex editor
// ---------------------------------------------------------------------------
function RegexEditor({ siteName, onClose }: { siteName: string; onClose: () => void }): JSX.Element {
  const [rows, setRows] = useState<LocationRegexRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { window.api.locations.listRegex(siteName).then(setRows) }, [siteName])

  function addRow() { setRows(prev => [...prev, { siteName, regex: '', matchName: '' }]) }
  function updateRow(i: number, field: 'regex' | 'matchName', v: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: v } : r))
  }
  function deleteRow(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)) }

  async function save() {
    setBusy(true); setError(null); setSaved(false)
    try { await window.api.locations.saveRegex(siteName, rows); setSaved(true) }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #dee2e6', paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Regex patterns</strong>
        <button onClick={addRow} style={btnSmall}>+ Add</button>
        <button onClick={save} disabled={busy} style={{ ...btnSmall, background: '#1c7ed6', color: '#fff' }}>
          {busy ? 'Saving…' : 'Save patterns'}
        </button>
        <button onClick={onClose} style={btnSmall}>Close</button>
        {saved && <span style={{ fontSize: 12, color: '#1a7f3c' }}>Saved</span>}
      </div>
      {error && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 6 }}>{error}</div>}
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={th}>Regex</th>
            <th style={th}>Match name</th>
            <th style={{ ...th, width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td style={td}>
                <input value={row.regex} onChange={e => updateRow(i, 'regex', e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid #ced4da', borderRadius: 3 }} />
              </td>
              <td style={td}>
                <input value={row.matchName ?? ''} onChange={e => updateRow(i, 'matchName', e.target.value)}
                  style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid #ced4da', borderRadius: 3 }} />
              </td>
              <td style={{ ...td, textAlign: 'center' }}>
                <button onClick={() => deleteRow(i)} style={{ ...btnSmall, color: '#c0392b' }}>✕</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} style={{ ...td, color: '#aaa', fontStyle: 'italic' }}>No patterns — click + Add</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const EMPTY: Location = { name: '', gridRef: '', lat: undefined, lon: undefined, country: '', region: '', notes: '' }

export default function LocationsPage(): JSX.Element {
  const [locations, setLocations] = useState<Location[]>([])
  const [editing, setEditing] = useState<Location | null>(null)
  const [editingPolygon, setEditingPolygon] = useState(false)
  const [polygonSnapshot, setPolygonSnapshot] = useState<string | null>(null)
  const [showRegex, setShowRegex] = useState(false)
  const [importResult, setImportResult] = useState<{ type: 'geojson' | 'regex'; imported: number; errors: string[] } | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [search, setSearch] = useState('')
  const pageRef = useRef<HTMLDivElement>(null)

  async function load() { setLocations(await window.api.locations.list()) }
  useEffect(() => { load() }, [])

  async function openEdit(loc: Location) {
    const full = loc.id ? await window.api.locations.get(loc.id) : { ...loc }
    setEditing(full)
    setEditingPolygon(false)
    setPolygonSnapshot(null)
    setShowRegex(false)
    pageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function save() {
    if (!editing) return
    await window.api.locations.upsert(editing)
    setEditing(null)
    setEditingPolygon(false)
    await load()
  }

  function startPolygonEdit() {
    setPolygonSnapshot(editing?.geometry ?? null)
    setEditingPolygon(true)
  }

  function cancelPolygonEdit() {
    setEditing(prev => prev ? { ...prev, geometry: polygonSnapshot } : prev)
    setEditingPolygon(false)
    setPolygonSnapshot(null)
  }

  function handleGeometryChange(geom: string, centroidLat: number, centroidLon: number) {
    setEditing(prev => prev ? { ...prev, geometry: geom, centroidLat, centroidLon } : prev)
  }

  async function importGeojson() {
    const path = await window.api.locations.openGeojsonFile()
    if (!path) return
    setImportBusy(true)
    setImportResult({ type: 'geojson', ...await window.api.locations.importGeojson(path) })
    setImportBusy(false)
    await load()
  }

  async function importRegexCsv() {
    const path = await window.api.locations.openRegexCsvFile()
    if (!path) return
    setImportBusy(true)
    setImportResult({ type: 'regex', ...await window.api.locations.importRegexCsv(path) })
    setImportBusy(false)
  }

  const filteredLocations = search.trim()
    ? locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()))
    : locations

  return (
    <div ref={pageRef} style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Locations</h1>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={importGeojson} disabled={importBusy} style={btnPrimary}>Import polygons (GeoJSON)…</button>
        <button onClick={importRegexCsv} disabled={importBusy} style={btnPrimary}>Import location regex (CSV)…</button>
        <button onClick={() => openEdit({ ...EMPTY })} style={btnSecondary}>Add location</button>
      </div>

      {importResult && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: importResult.errors.length ? '#ffe3e3' : '#d3f9d8', borderRadius: 4, fontSize: 13 }}>
          {importResult.type === 'geojson' ? 'GeoJSON' : 'Regex CSV'}: {importResult.imported} imported
          {importResult.errors.length > 0 && (
            <details style={{ marginTop: 4 }}>
              <summary>{importResult.errors.length} errors</summary>
              <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {editing && (
        <div style={{ margin: '0 0 16px', padding: 16, border: '1px solid #ced4da', borderRadius: 6, background: '#fff' }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>{editing.id ? 'Edit' : 'New'} — {editing.name || 'location'}</h2>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {/* Left: fields */}
            <div style={{ flex: '0 0 220px' }}>
              <label style={labelStyle}>
                Name
                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={inputStyle} />
              </label>
              {(['gridRef', 'country', 'region', 'notes'] as const).map(field => (
                <label key={field} style={labelStyle}>
                  {field === 'gridRef' ? 'Grid ref' : field.charAt(0).toUpperCase() + field.slice(1)}
                  <input value={(editing[field] as string) ?? ''} onChange={e => setEditing({ ...editing, [field]: e.target.value })} style={inputStyle} />
                </label>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                {(['lat', 'lon'] as const).map(f => (
                  <label key={f} style={{ ...labelStyle, flex: 1 }}>
                    {f === 'lat' ? 'Lat' : 'Lon'}
                    <input type="number" step="any" value={editing[f] ?? ''} onChange={e => setEditing({ ...editing, [f]: e.target.value ? parseFloat(e.target.value) : undefined })} style={inputStyle} />
                  </label>
                ))}
              </div>
              {editing.centroidLat != null && (
                <div style={{ fontSize: 11, color: '#888', margin: '4px 0 8px' }}>
                  Centroid: {editing.centroidLat.toFixed(5)}, {editing.centroidLon?.toFixed(5)}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={save} style={btnPrimary}>Save</button>
                {editing.id && (
                  <button onClick={() => setShowRegex(r => !r)} style={btnSecondary}>
                    {showRegex ? 'Hide' : 'Edit'} regex patterns
                  </button>
                )}
                <button onClick={() => { setEditing(null); setEditingPolygon(false) }} style={btnSecondary}>Cancel</button>
              </div>
            </div>

            {/* Right: map */}
            <div style={{ flex: '1 1 400px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#666' }}>Polygon</span>
                {!editingPolygon && editing.geometry && (
                  <button onClick={startPolygonEdit} style={btnSmall}>Edit polygon</button>
                )}
                {editingPolygon && (
                  <>
                    <span style={{ fontSize: 12, color: '#1864ab' }}>Drag vertices to reshape</span>
                    <button onClick={() => setEditingPolygon(false)} style={{ ...btnSmall, background: '#1c7ed6', color: '#fff' }}>Done</button>
                    <button onClick={cancelPolygonEdit} style={btnSmall}>Cancel</button>
                  </>
                )}
              </div>
              <LocationMap
                key={editing.id ?? 'new'}
                initialGeometry={editing.geometry}
                editMode={editingPolygon}
                onGeometryChange={handleGeometryChange}
                currentLocationId={editing.id}
              />
            </div>
          </div>

          {showRegex && editing.name && (
            <RegexEditor siteName={editing.name} onClose={() => setShowRegex(false)} />
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 6px' }}>
        <input
          type="search"
          placeholder="Search locations…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '5px 9px', border: '1px solid #ced4da', borderRadius: 4, fontSize: 13, width: 240 }}
        />
        {search && <span style={{ fontSize: 12, color: '#868e96' }}>{filteredLocations.length} of {locations.length}</span>}
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 4, fontSize: 13 }}>
        <thead>
          <tr>
            {['Name', 'Grid ref', 'Centroid lat', 'Centroid lon', 'Country', 'Region', ''].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredLocations.map((loc, i) => (
            <tr key={loc.id ?? i} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
              <td style={td}>{loc.name}</td>
              <td style={td}>{loc.gridRef}</td>
              <td style={td}>{loc.centroidLat != null ? (loc.centroidLat as number).toFixed(5) : ''}</td>
              <td style={td}>{loc.centroidLon != null ? (loc.centroidLon as number).toFixed(5) : ''}</td>
              <td style={td}>{loc.country}</td>
              <td style={td}>{loc.region}</td>
              <td style={td}><button onClick={() => openEdit(loc)} style={btnSmall}>Edit</button></td>
            </tr>
          ))}
          {filteredLocations.length === 0 && (
            <tr><td colSpan={7} style={{ ...td, color: '#aaa', fontStyle: 'italic' }}>
              {locations.length === 0 ? 'No locations — import a GeoJSON file to get started' : 'No locations match your search'}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 10px', background: '#f1f3f5', border: '1px solid #dee2e6', textAlign: 'left' }
const td: React.CSSProperties = { padding: '5px 10px', border: '1px solid #dee2e6' }
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 8, fontSize: 13 }
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '4px 7px', border: '1px solid #ced4da', borderRadius: 4, marginTop: 2, fontSize: 13, boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { padding: '7px 14px', background: '#1c7ed6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
const btnSecondary: React.CSSProperties = { padding: '7px 14px', background: '#f1f3f5', color: '#1a1a1a', border: '1px solid #ced4da', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
const btnSmall: React.CSSProperties = { padding: '3px 8px', background: '#e9ecef', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 }
