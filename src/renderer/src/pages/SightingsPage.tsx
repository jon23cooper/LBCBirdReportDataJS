import { useEffect, useState } from 'react'
import type { Sighting, SpeciesRecord, Location } from '../../../shared/types'

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

// Fields shown in the edit panel
const EDIT_FIELDS: { key: keyof Sighting; label: string; type: 'text' | 'number' | 'textarea' | 'species' | 'location' }[] = [
  { key: 'date',                 label: 'First Date',              type: 'text' },
  { key: 'lastDate',             label: 'Last Date',               type: 'text' },
  { key: 'commonName',           label: 'Common Name',             type: 'species' },
  { key: 'scientificName',       label: 'Scientific Name',         type: 'text' },
  { key: 'family',               label: 'Family',                  type: 'text' },
  { key: 'subspeciesCommon',     label: 'Subspecies (common)',      type: 'text' },
  { key: 'subspeciesScientific', label: 'Subspecies (scientific)',  type: 'text' },
  { key: 'count',                label: 'Total Count',             type: 'number' },
  { key: 'circa',                label: 'Circa',                   type: 'text' },
  { key: 'age',                  label: 'Age',                     type: 'text' },
  { key: 'status',               label: 'Status',                  type: 'text' },
  { key: 'breedingCode',         label: 'Breeding Code',           type: 'text' },
  { key: 'breedingCategory',     label: 'Breeding Category',       type: 'text' },
  { key: 'observer',             label: 'Observers',               type: 'text' },
  { key: 'time',                 label: 'Start Time',              type: 'text' },
  { key: 'endTime',              label: 'End Time',                type: 'text' },
  { key: 'originalLocation',     label: 'Original Location',       type: 'text' },
  { key: 'locationId',           label: 'Resolved Location',       type: 'location' },
  { key: 'notes',                label: 'Notes',                   type: 'textarea' },
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
  const [editing, setEditing] = useState<Sighting | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [speciesList, setSpeciesList] = useState<SpeciesRecord[]>([])
  const [locationsList, setLocationsList] = useState<Location[]>([])
  const [busy, setBusy] = useState(false)

  async function load() {
    window.api.sightings.list().then(setRows)
    window.api.batches.list().then(list => {
      setBatches(new Map(list.map(b => [b.id, { id: b.id, filename: b.filename, storedFile: b.storedFile }])))
    })
  }

  useEffect(() => {
    load()
    window.api.species.list().then(setSpeciesList)
    window.api.locations.list().then(setLocationsList)
  }, [])

  const visibleCols = COLS.filter(({ key }) => rows.some(r => r[key] != null && r[key] !== ''))
  const batchFiltered = batchFilter != null ? rows.filter(r => r.importBatchId === batchFilter) : rows
  const filtered = filter
    ? batchFiltered.filter(r => visibleCols.some(({ key }) => String(r[key] ?? '').toLowerCase().includes(filter.toLowerCase())))
    : batchFiltered
  const activeBatch = batchFilter != null ? batches.get(batchFilter) : null

  async function saveEdit() {
    if (!editing?.id) return
    setBusy(true)
    try {
      const { id, importBatchId, lbcId, locationMatchName, rawData, ...changes } = editing
      await window.api.sightings.update(editing.id, changes)
      setEditing(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function deleteSighting(id: number) {
    await window.api.sightings.delete(id)
    setConfirmDelete(null)
    await load()
  }

  function handleSpeciesChange(commonName: string) {
    if (!editing) return
    const sp = speciesList.find(s => s.commonName === commonName)
    setEditing(sp
      ? { ...editing, commonName: sp.commonName, scientificName: sp.scientificName, family: sp.family ?? undefined, species: sp.commonName }
      : { ...editing, commonName, species: commonName }
    )
  }

  function handleLocationChange(locationId: number | undefined) {
    if (!editing) return
    const loc = locationId != null ? locationsList.find(l => l.id === locationId) : undefined
    setEditing({ ...editing, locationId: locationId ?? null, locationMatchName: loc?.name ?? null })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Sightings</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Filter…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
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

      {/* Edit panel */}
      {editing && (
        <div style={{ padding: 16, border: '1px solid #ced4da', borderRadius: 6, background: '#fff', flexShrink: 0 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Edit sighting — {editing.lbcId}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px 20px' }}>
            {EDIT_FIELDS.map(({ key, label, type }) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#555' }}>{label}</span>
                {type === 'species' ? (
                  <select
                    value={String(editing[key] ?? '')}
                    onChange={e => handleSpeciesChange(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">(none)</option>
                    {speciesList.map(sp => <option key={sp.id} value={sp.commonName}>{sp.commonName}</option>)}
                  </select>
                ) : type === 'location' ? (
                  <select
                    value={editing.locationId ?? ''}
                    onChange={e => handleLocationChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    style={inputStyle}
                  >
                    <option value="">(none)</option>
                    {locationsList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                ) : type === 'textarea' ? (
                  <textarea
                    value={String(editing[key] ?? '')}
                    onChange={e => setEditing({ ...editing, [key]: e.target.value })}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                ) : type === 'number' ? (
                  <input
                    type="number"
                    value={editing[key] != null ? String(editing[key]) : ''}
                    onChange={e => setEditing({ ...editing, [key]: e.target.value ? parseInt(e.target.value, 10) : null })}
                    style={inputStyle}
                  />
                ) : (
                  <input
                    type="text"
                    value={String(editing[key] ?? '')}
                    onChange={e => setEditing({ ...editing, [key]: e.target.value || null })}
                    style={inputStyle}
                  />
                )}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={saveEdit} disabled={busy} style={btnPrimary}>{busy ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setEditing(null)} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th style={th}></th>
              <th style={th}>Source file</th>
              {visibleCols.map(({ key, label }) => <th key={key} style={th}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const batch = row.importBatchId != null ? batches.get(row.importBatchId) : undefined
              return (
                <tr key={row.id ?? i} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {confirmDelete === row.id ? (
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#c0392b' }}>Delete?</span>
                        <button onClick={() => deleteSighting(row.id!)} style={{ ...btnSmall, color: '#c0392b', fontWeight: 600 }}>Yes</button>
                        <button onClick={() => setConfirmDelete(null)} style={btnSmall}>No</button>
                      </span>
                    ) : (
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setConfirmDelete(null); setEditing({ ...row }) }} style={btnSmall}>Edit</button>
                        <button onClick={() => { setEditing(null); setConfirmDelete(row.id ?? null) }} style={{ ...btnSmall, color: '#c0392b' }}>Delete</button>
                      </span>
                    )}
                  </td>
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
const btnPrimary: React.CSSProperties = { padding: '6px 14px', background: '#1c7ed6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
const btnSecondary: React.CSSProperties = { padding: '6px 12px', background: '#f1f3f5', border: '1px solid #dee2e6', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
const inputStyle: React.CSSProperties = { padding: '4px 7px', fontSize: 13, border: '1px solid #ced4da', borderRadius: 4, width: '100%', boxSizing: 'border-box' }
