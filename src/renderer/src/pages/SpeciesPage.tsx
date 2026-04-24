import { useState, useEffect, useRef } from 'react'
import type { SpeciesRecord } from '../../../shared/types'

type EditingRow = SpeciesRecord & { isNew?: boolean }

export default function SpeciesPage(): JSX.Element {
  const [records, setRecords] = useState<SpeciesRecord[]>([])
  const [editing, setEditing] = useState<EditingRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [filter, setFilter] = useState('')
  const filterRef = useRef<HTMLInputElement>(null)

  async function load() {
    setRecords(await window.api.species.list())
  }

  useEffect(() => { load() }, [])

  const filtered = filter.trim()
    ? records.filter(r =>
        r.commonName.toLowerCase().includes(filter.toLowerCase()) ||
        r.scientificName.toLowerCase().includes(filter.toLowerCase()) ||
        (r.family ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : records

  async function saveEditing() {
    if (!editing) return
    setBusy(true)
    try {
      await window.api.species.upsert(editing)
      setEditing(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function importCsv() {
    const filePath = await window.api.species.openCsvFile()
    if (!filePath) return
    setBusy(true)
    setImportResult(null)
    try {
      const result = await window.api.species.importCsv(filePath)
      setImportResult(result)
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={h1}>Species</h1>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={importCsv} disabled={busy} style={btnSecondary}>
          Import CSV…
        </button>
        <button onClick={() => setEditing({ commonName: '', scientificName: '', isNew: true })} style={btnSecondary}>
          + Add species
        </button>
        <input
          ref={filterRef}
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter…"
          style={{ fontSize: 13, padding: '4px 8px', marginLeft: 'auto', width: 220 }}
        />
        <span style={{ fontSize: 12, color: '#888' }}>{filtered.length} of {records.length}</span>
      </div>

      <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
        CSV columns expected: <code>common_name</code>, <code>common_name_regex</code>, <code>scientific_name</code>, <code>scientific_name_regex</code>, <code>family</code>
      </p>

      {importResult && (
        <div style={{ padding: '8px 12px', background: importResult.errors.length ? '#ffe3e3' : '#d3f9d8', borderRadius: 4, fontSize: 13 }}>
          {importResult.imported} species imported.
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
        <div style={{ padding: 12, border: '1px solid #dee2e6', borderRadius: 6, background: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 600 }}>
          <strong style={{ fontSize: 14 }}>{editing.isNew ? 'New species' : 'Edit species'}</strong>
          {([
            ['commonName', 'Common name *'],
            ['commonNameRegex', 'Common name regex'],
            ['scientificName', 'Scientific name *'],
            ['scientificNameRegex', 'Scientific name regex'],
            ['family', 'Family'],
          ] as [keyof EditingRow, string][]).map(([field, label]) => (
            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ width: 180, fontSize: 13, flexShrink: 0 }}>{label}</label>
              <input
                value={String(editing[field] ?? '')}
                onChange={e => setEditing({ ...editing, [field]: e.target.value })}
                style={{ flex: 1, fontSize: 13, padding: '3px 6px' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={saveEditing} disabled={busy || !editing.commonName || !editing.scientificName} style={btnPrimary}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(null)} style={btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ overflowY: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Common name</th>
              <th style={th}>Common regex</th>
              <th style={th}>Scientific name</th>
              <th style={th}>Scientific regex</th>
              <th style={th}>Family</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={td}>{r.commonName}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: '#555' }}>{r.commonNameRegex ?? ''}</td>
                <td style={{ ...td, fontStyle: 'italic' }}>{r.scientificName}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: '#555' }}>{r.scientificNameRegex ?? ''}</td>
                <td style={td}>{r.family ?? ''}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <button onClick={() => setEditing({ ...r })} style={btnInline}>Edit</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, color: '#888', textAlign: 'center', padding: 24 }}>
                {records.length === 0 ? 'No species loaded — import a CSV to get started.' : 'No matches.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const h1: React.CSSProperties = { fontSize: 22, marginBottom: 4 }
const th: React.CSSProperties = { padding: '6px 10px', background: '#f1f3f5', border: '1px solid #dee2e6', textAlign: 'left', fontSize: 13, position: 'sticky', top: 0 }
const td: React.CSSProperties = { padding: '5px 10px', fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '6px 14px', background: '#1c7ed6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
const btnSecondary: React.CSSProperties = { padding: '6px 12px', background: '#f1f3f5', border: '1px solid #dee2e6', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
const btnInline: React.CSSProperties = { padding: '2px 8px', background: '#f1f3f5', border: '1px solid #dee2e6', borderRadius: 3, cursor: 'pointer', fontSize: 12 }
