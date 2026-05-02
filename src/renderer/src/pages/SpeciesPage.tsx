import { useState, useEffect, useRef } from 'react'
import type { SpeciesRecord } from '../../../shared/types'

type EditingRow = SpeciesRecord & { isNew?: boolean }

type ColDef = {
  key: keyof SpeciesRecord
  label: string
  mono?: boolean
  italic?: boolean
}

const TABLE_COLS: ColDef[] = [
  { key: 'commonName',          label: 'Common name' },
  { key: 'commonNameRegex',     label: 'Common regex',     mono: true },
  { key: 'scientificName',      label: 'Scientific name',  italic: true },
  { key: 'scientificNameRegex', label: 'Scientific regex', mono: true },
  { key: 'family',              label: 'Family' },
]

export default function SpeciesPage(): JSX.Element {
  const [records, setRecords] = useState<SpeciesRecord[]>([])
  const [editing, setEditing] = useState<EditingRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [filter, setFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<Partial<Record<keyof SpeciesRecord, string>>>({})
  const [sortKey, setSortKey] = useState<keyof SpeciesRecord | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const filterRef = useRef<HTMLInputElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editing) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editing])

  async function load() {
    setRecords(await window.api.species.list())
  }

  useEffect(() => { load() }, [])

  function handleSort(key: keyof SpeciesRecord) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // Global filter
  const globalFiltered = filter.trim()
    ? records.filter(r =>
        r.commonName.toLowerCase().includes(filter.toLowerCase()) ||
        r.scientificName.toLowerCase().includes(filter.toLowerCase()) ||
        (r.family ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : records

  // Column filters
  const activeColFilters = (Object.entries(columnFilters) as [keyof SpeciesRecord, string][])
    .filter(([, v]) => v.trim() !== '')
  const colFiltered = activeColFilters.length
    ? globalFiltered.filter(r => activeColFilters.every(([key, val]) =>
        String(r[key] ?? '').toLowerCase().includes(val.toLowerCase())
      ))
    : globalFiltered

  // Sort
  const displayed = sortKey
    ? [...colFiltered].sort((a, b) => {
        const av = String(a[sortKey] ?? '').toLowerCase()
        const bv = String(b[sortKey] ?? '').toLowerCase()
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    : colFiltered

  async function deleteSpecies(id: number) {
    await window.api.species.delete(id)
    setConfirmDelete(null)
    await load()
  }

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
    <div ref={topRef} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={h1}>Species</h1>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={importCsv} disabled={busy} style={btnSecondary}>
          Import CSV…
        </button>
        <input
          ref={filterRef}
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter…"
          style={{ fontSize: 13, padding: '4px 8px', width: 220, border: '1px solid #ced4da', borderRadius: 4 }}
        />
        <span style={{ fontSize: 12, color: '#888' }}>{displayed.length} of {records.length}</span>
        {activeColFilters.length > 0 && (
          <button onClick={() => setColumnFilters({})} style={{ ...btnSecondary, fontSize: 11, padding: '2px 8px' }}>
            Clear column filters
          </button>
        )}
        <button onClick={() => setEditing({ commonName: '', scientificName: '', isNew: true })} style={{ ...btnSecondary, marginLeft: 'auto' }}>
          + Add species
        </button>
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
              {TABLE_COLS.map(col => (
                <th
                  key={col.key}
                  style={{ ...th, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort(col.key)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span>
                      {col.label}
                      {sortKey === col.key && (
                        <span style={{ marginLeft: 4, opacity: 0.6 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </span>
                    <input
                      value={columnFilters[col.key] ?? ''}
                      onChange={e => setColumnFilters(f => ({ ...f, [col.key]: e.target.value }))}
                      onClick={e => e.stopPropagation()}
                      placeholder="Filter…"
                      style={filterInput}
                    />
                  </div>
                </th>
              ))}
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                {TABLE_COLS.map(col => (
                  <td
                    key={col.key}
                    style={{
                      ...td,
                      ...(col.mono ? { fontFamily: 'monospace', fontSize: 12, color: '#555' } : {}),
                      ...(col.italic ? { fontStyle: 'italic' } : {}),
                    }}
                  >
                    {String(r[col.key] ?? '')}
                  </td>
                ))}
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {confirmDelete === r.id ? (
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#c0392b' }}>Delete?</span>
                      <button onClick={() => deleteSpecies(r.id!)} style={{ ...btnInline, color: '#c0392b', fontWeight: 600 }}>Yes</button>
                      <button onClick={() => setConfirmDelete(null)} style={btnInline}>No</button>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setConfirmDelete(null); setEditing({ ...r }) }} style={btnInline}>Edit</button>
                      <button onClick={() => { setEditing(null); setConfirmDelete(r.id ?? null) }} style={{ ...btnInline, color: '#c0392b' }}>Delete</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr><td colSpan={TABLE_COLS.length + 1} style={{ ...td, color: '#888', textAlign: 'center', padding: 24 }}>
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
const th: React.CSSProperties = { padding: '6px 10px', background: '#f1f3f5', border: '1px solid #dee2e6', textAlign: 'left', fontSize: 13, position: 'sticky', top: 0, verticalAlign: 'top' }
const td: React.CSSProperties = { padding: '5px 10px', fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '6px 14px', background: '#1c7ed6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
const btnSecondary: React.CSSProperties = { padding: '6px 12px', background: '#f1f3f5', border: '1px solid #dee2e6', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
const btnInline: React.CSSProperties = { padding: '2px 8px', background: '#f1f3f5', border: '1px solid #dee2e6', borderRadius: 3, cursor: 'pointer', fontSize: 12 }
const filterInput: React.CSSProperties = { fontSize: 11, padding: '2px 4px', width: '100%', border: '1px solid #ced4da', borderRadius: 3, fontWeight: 400, fontFamily: 'inherit', fontStyle: 'normal', cursor: 'text' }
