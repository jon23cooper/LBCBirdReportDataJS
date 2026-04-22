import { useState } from 'react'

export default function ExportPage(): JSX.Element {
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function exportSql(): Promise<void> {
    setBusy(true)
    try {
      const path = await window.api.export.sql()
      setResult(path ?? 'Cancelled')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Export</h1>

      <div style={{ padding: 20, border: '1px solid #dee2e6', borderRadius: 6, background: '#fff', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 8 }}>Postgres SQL dump</h2>
        <p style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
          Exports all locations and sightings as a <code>.sql</code> file containing
          <code>CREATE TABLE</code> and <code>INSERT</code> statements compatible with PostgreSQL.
        </p>
        <button onClick={exportSql} disabled={busy} style={btnPrimary}>
          {busy ? 'Exporting…' : 'Save SQL file…'}
        </button>
      </div>

      {result && result !== 'Cancelled' && (
        <p style={{ fontSize: 13, color: '#2f9e44' }}>Saved to {result}</p>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#1c7ed6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }
