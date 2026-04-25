import { useEffect, useState } from 'react'

interface Batch {
  id: number
  filename: string
  format: string
  importedAt: string
  rowCount: number | null
  storedFile: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function HistoryPage(): JSX.Element {
  const [batches, setBatches] = useState<Batch[]>([])
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  async function load() { setBatches(await window.api.batches.list()) }
  useEffect(() => { load() }, [])

  async function deleteBatch(id: number) {
    await window.api.batches.delete(id)
    setConfirmDelete(null)
    await load()
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Import History</h1>

      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {['Date', 'Filename', 'Format', 'Records', 'Source file', ''].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {batches.map((b, i) => (
            <tr key={b.id} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
              <td style={td}>{formatDate(b.importedAt)}</td>
              <td style={td}>{b.filename}</td>
              <td style={{ ...td, textTransform: 'uppercase', fontSize: 11 }}>{b.format}</td>
              <td style={{ ...td, textAlign: 'right' }}>{b.rowCount ?? '—'}</td>
              <td style={td}>
                {b.storedFile
                  ? <span style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => window.api.batches.openFile(b.storedFile!)} style={btnSmall}>Open</button>
                      <button onClick={() => window.api.batches.revealFile(b.storedFile!)} style={btnSmall}>Reveal in Finder</button>
                    </span>
                  : <button onClick={async () => {
                      const path = await window.api.batches.locateFile(b.id)
                      if (path) await load()
                    }} style={btnSmall}>Locate file…</button>
                }
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {confirmDelete === b.id ? (
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#c0392b' }}>Delete {b.rowCount ?? 0} records?</span>
                    <button onClick={() => deleteBatch(b.id)} style={{ ...btnSmall, color: '#c0392b', fontWeight: 600 }}>Yes, delete</button>
                    <button onClick={() => setConfirmDelete(null)} style={btnSmall}>Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDelete(b.id)} style={{ ...btnSmall, color: '#c0392b' }}>Delete</button>
                )}
              </td>
            </tr>
          ))}
          {batches.length === 0 && (
            <tr><td colSpan={6} style={{ ...td, color: '#aaa', fontStyle: 'italic' }}>No imports yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 10px', background: '#f1f3f5', border: '1px solid #dee2e6', textAlign: 'left' }
const td: React.CSSProperties = { padding: '5px 10px', border: '1px solid #dee2e6', verticalAlign: 'middle' }
const btnSmall: React.CSSProperties = { padding: '3px 8px', background: '#e9ecef', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 }
