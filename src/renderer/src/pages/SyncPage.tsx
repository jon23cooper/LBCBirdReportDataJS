import { useState, useEffect, useCallback } from 'react'

interface Batch {
  id: number
  filename: string
  importedAt: string
  rowCount: number
  pushedAt: string | null
}

interface SyncStatus {
  pushedBatches: number
  unpushedBatches: number
  lastSyncAt: string | null
  batches: Batch[]
}

type OpState = 'idle' | 'running' | 'done' | 'error'

interface OpResult {
  state: OpState
  message: string
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function SyncPage(): JSX.Element {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [ops, setOps] = useState<Record<string, OpResult>>({})

  const loadStatus = useCallback(async () => {
    try {
      const s = await (window as any).api.sync.getStatus()
      setStatus(s)
    } catch (err: any) {
      console.error('Failed to load sync status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  function setOp(key: string, state: OpState, message: string) {
    setOps(prev => ({ ...prev, [key]: { state, message } }))
  }

  async function run(key: string, fn: () => Promise<string>) {
    setOp(key, 'running', 'Working…')
    try {
      const msg = await fn()
      setOp(key, 'done', msg)
      await loadStatus()
    } catch (err: any) {
      setOp(key, 'error', err.message ?? 'Unknown error')
    }
  }

  async function handlePushLocations() {
    await run('locations', async () => {
      const r = await (window as any).api.sync.pushLocations()
      return `Pushed ${r.pushed} locations`
    })
  }

  async function handlePushSpecies() {
    await run('species', async () => {
      const r = await (window as any).api.sync.pushSpecies()
      return `Pushed ${r.pushed} species`
    })
  }

  async function handlePushBatch(batchId: number) {
    await run(`batch-${batchId}`, async () => {
      const r = await (window as any).api.sync.pushBatch(batchId)
      return `Inserted ${r.inserted}, updated ${r.updated}`
    })
  }

  async function handlePushAll() {
    await run('push-all', async () => {
      const r = await (window as any).api.sync.pushAllUnpushed()
      return `Pushed ${r.batches} batches — inserted ${r.inserted}, updated ${r.updated}`
    })
  }

  async function handleSyncBack() {
    await run('sync-back', async () => {
      const r = await (window as any).api.sync.syncBack()
      return `Updated ${r.updated}, deleted ${r.deleted}, inserted ${r.inserted}, assigned IDs to ${r.assigned}`
    })
  }

  function opIndicator(key: string) {
    const op = ops[key]
    if (!op) return null
    const colour = op.state === 'done' ? '#2e7d32' : op.state === 'error' ? '#c62828' : '#1565c0'
    const prefix = op.state === 'running' ? '⟳ ' : op.state === 'done' ? '✓ ' : '✗ '
    return <span style={{ fontSize: 12, color: colour, marginLeft: 10 }}>{prefix}{op.message}</span>
  }

  if (loading) return <div style={styles.empty}>Loading…</div>

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Sync</h1>
      <p style={styles.sub}>
        Push data from this machine to the Pi, or pull web edits back into this database.
      </p>

      {/* Status summary */}
      {status && (
        <div style={styles.statusRow}>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{status.pushedBatches}</div>
            <div style={styles.statLabel}>Batches pushed</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ ...styles.statNum, color: status.unpushedBatches > 0 ? '#c62828' : '#2e7d32' }}>
              {status.unpushedBatches}
            </div>
            <div style={styles.statLabel}>Batches not yet pushed</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{fmt(status.lastSyncAt)}</div>
            <div style={styles.statLabel}>Last sync-back</div>
          </div>
        </div>
      )}

      {/* Reference data */}
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>Reference Data</h2>
        <p style={styles.sectionSub}>Push once at the start of each report season to populate locations and species on the Pi.</p>
        <div style={styles.btnRow}>
          <button
            style={styles.btn}
            disabled={ops['locations']?.state === 'running'}
            onClick={handlePushLocations}
          >
            Push Locations
          </button>
          {opIndicator('locations')}
        </div>
        <div style={styles.btnRow}>
          <button
            style={styles.btn}
            disabled={ops['species']?.state === 'running'}
            onClick={handlePushSpecies}
          >
            Push Species
          </button>
          {opIndicator('species')}
        </div>
      </section>

      {/* Push sightings */}
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>Push Sightings to Web</h2>
        <p style={styles.sectionSub}>
          Pushes records to the Pi so the web team can view and edit them.
          Only unpushed batches are sent — existing web edits are not overwritten.
        </p>
        <div style={styles.btnRow}>
          <button
            style={{ ...styles.btn, background: '#1565c0', color: '#fff' }}
            disabled={ops['push-all']?.state === 'running' || status?.unpushedBatches === 0}
            onClick={handlePushAll}
          >
            Push All Unpushed Batches
          </button>
          {opIndicator('push-all')}
        </div>
      </section>

      {/* Sync back */}
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>Sync Back from Web</h2>
        <p style={styles.sectionSub}>
          Pulls all edits made by the web team since the last sync back into this database.
          Web-created records will be assigned LBC IDs. Run this at the end of report season.
        </p>
        <div style={styles.btnRow}>
          <button
            style={{ ...styles.btn, background: '#2e7d32', color: '#fff' }}
            disabled={ops['sync-back']?.state === 'running'}
            onClick={handleSyncBack}
          >
            Sync Back from Web
          </button>
          {opIndicator('sync-back')}
        </div>
      </section>

      {/* Batch list */}
      {status && status.batches.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionHeading}>Import Batches</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Filename', 'Imported', 'Rows', 'Pushed', ''].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {status.batches.map((b, i) => (
                <tr key={b.id} style={{ background: i % 2 === 0 ? 'transparent' : '#f8f9fa' }}>
                  <td style={styles.td}>{b.filename}</td>
                  <td style={styles.td}>{fmt(b.importedAt)}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace', textAlign: 'right' }}>{b.rowCount?.toLocaleString()}</td>
                  <td style={{ ...styles.td, color: b.pushedAt ? '#2e7d32' : '#c62828' }}>
                    {b.pushedAt ? fmt(b.pushedAt) : 'Not pushed'}
                  </td>
                  <td style={styles.td}>
                    {!b.pushedAt && (
                      <>
                        <button
                          style={styles.smallBtn}
                          disabled={ops[`batch-${b.id}`]?.state === 'running'}
                          onClick={() => handlePushBatch(b.id)}
                        >
                          Push
                        </button>
                        {opIndicator(`batch-${b.id}`)}
                      </>
                    )}
                    {b.pushedAt && <span style={{ fontSize: 12, color: '#2e7d32' }}>✓ Pushed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page:    { maxWidth: 860, margin: '0 auto' },
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  sub:     { color: '#555', fontSize: 14, marginBottom: 24 },
  empty:   { padding: 24, color: '#888', fontFamily: 'monospace' },
  statusRow: {
    display: 'flex', gap: 16, marginBottom: 28,
  },
  statBox: {
    flex: 1, border: '1px solid #dee2e6', borderRadius: 8,
    padding: '16px 20px', background: '#f8f9fa',
  },
  statNum:   { fontSize: 22, fontWeight: 700, color: '#1c7ed6', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' },
  section: { marginBottom: 32, borderTop: '1px solid #dee2e6', paddingTop: 20 },
  sectionHeading: { fontSize: 15, fontWeight: 600, marginBottom: 6 },
  sectionSub: { fontSize: 13, color: '#666', marginBottom: 14 },
  btnRow: { display: 'flex', alignItems: 'center', marginBottom: 10 },
  btn: {
    padding: '8px 16px', border: '1px solid #dee2e6', borderRadius: 6,
    background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  smallBtn: {
    padding: '4px 10px', border: '1px solid #dee2e6', borderRadius: 4,
    background: '#fff', fontSize: 12, cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    padding: '8px 12px', textAlign: 'left', fontWeight: 600,
    fontSize: 11, color: '#888', textTransform: 'uppercase',
    letterSpacing: '0.04em', borderBottom: '2px solid #dee2e6',
  },
  td: { padding: '8px 12px', borderBottom: '1px solid #dee2e6' },
}
