import { useState, useEffect } from 'react'
import type { ParsedSighting, StagingData, SpeciesRecord, Location, LocationCandidate } from '../../../shared/types'

type Col = {
  key: keyof ParsedSighting
  label: string
  editable?: 'species' | 'text' | 'textarea' | 'number' | 'location'
  alwaysShow?: boolean
}

const COLS: Col[] = [
  { key: 'date',                  label: 'First Date' },
  { key: 'lastDate',              label: 'Last Date' },
  { key: 'dataset',               label: 'Dataset' },
  { key: 'originalCommonName',    label: 'Original Common Name' },
  { key: 'commonName',            label: 'Common Name (display)', editable: 'species' },
  { key: 'originalScientificName',label: 'Original Scientific Name' },
  { key: 'scientificName',        label: 'Scientific Name' },
  { key: 'family',                label: 'Family' },
  { key: 'subspeciesCommon',      label: 'Subspecies (common)',     editable: 'text', alwaysShow: true },
  { key: 'subspeciesScientific',  label: 'Subspecies (scientific)', editable: 'text', alwaysShow: true },
  { key: 'originalCount',         label: 'Original Total Count' },
  { key: 'count',                 label: 'Total Count',           editable: 'number' },
  { key: 'circa',                 label: 'Circa' },
  { key: 'age',                   label: 'Age',                   editable: 'text' },
  { key: 'status',                label: 'Status',                editable: 'text' },
  { key: 'breedingCode',          label: 'Breeding Code',         editable: 'text' },
  { key: 'observer',              label: 'Observers',             editable: 'text' },
  { key: 'originalLocation',      label: 'Original Location' },
  { key: 'locationName',          label: 'Location',              editable: 'text' },
  { key: 'locationMatchName',     label: 'Matched Location' },
  { key: 'locationId',            label: 'Location override',     editable: 'location', alwaysShow: true },
  { key: 'time',                  label: 'Start Time' },
  { key: 'notes',                 label: 'Notes',                 editable: 'textarea' },
]

const QUALITY_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  'exact-scientific': { text: 'Exact sci.',  color: '#1a7f3c', bg: '#d3f9d8' },
  'exact-common':     { text: 'Exact name',  color: '#1a7f3c', bg: '#d3f9d8' },
  'regex-scientific': { text: 'Regex sci.',  color: '#7c5700', bg: '#fff3bf' },
  'regex-common':     { text: 'Regex name',  color: '#7c5700', bg: '#fff3bf' },
  'manual':           { text: 'Manual',      color: '#1864ab', bg: '#d0ebff' },
  'none':             { text: 'No match',    color: '#c0392b', bg: '#ffe3e3' },
}

const LOCATION_QUALITY_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  'confirmed':    { text: 'Confirmed',   color: '#1a7f3c', bg: '#d3f9d8' },
  'cache':        { text: 'Cached',      color: '#1a7f3c', bg: '#d3f9d8' },
  'spatial-only': { text: 'Spatial',     color: '#7c5700', bg: '#fff3bf' },
  'name-only':    { text: 'Name match',  color: '#7c5700', bg: '#fff3bf' },
  'conflict':     { text: 'Conflict',    color: '#c0392b', bg: '#ffe3e3' },
  'none':         { text: 'No match',    color: '#c0392b', bg: '#ffe3e3' },
  'manual':       { text: 'Manual',      color: '#1864ab', bg: '#d0ebff' },
}

function formatCacheDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function QualityBreakdown({ label, counts, labelMap, activeFilter, onFilter }: {
  label: string
  counts: [string, number][]
  labelMap: Record<string, { text: string; color: string; bg: string }>
  activeFilter: string
  onFilter: (q: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ color: '#555', fontWeight: 600, minWidth: 60 }}>{label}:</span>
      {counts.map(([q, n]) => {
        const style = labelMap[q] ?? { text: q, color: '#555', bg: '#e9ecef' }
        const active = activeFilter === q
        return (
          <button
            key={q}
            onClick={() => onFilter(active ? '' : q)}
            title={active ? 'Click to clear filter' : `Filter to ${style.text}`}
            style={{
              padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: active ? '2px solid rgba(0,0,0,0.3)' : '2px solid transparent',
              color: style.color, background: style.bg,
            }}
          >
            {style.text}: {n}
          </button>
        )
      })}
    </div>
  )
}

export default function StagingPage({ stagingData, rows, onRowsChange, onBack, onSuccess }: {
  stagingData: StagingData
  rows: ParsedSighting[]
  onRowsChange: (rows: ParsedSighting[]) => void
  onBack: () => void
  onSuccess: () => void
}): JSX.Element {
  const { warnings, filename, filePath, format, mapping } = stagingData
  const [speciesList, setSpeciesList] = useState<SpeciesRecord[]>([])
  const [locationsList, setLocationsList] = useState<Location[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingUnmatched, setConfirmingUnmatched] = useState(false)
  const [speciesFilter, setSpeciesFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [rememberedThisSession, setRememberedThisSession] = useState<Set<string>>(new Set())
  const [cacheEntries, setCacheEntries] = useState<{ rawString: string; locationName: string; confirmedAt: string }[]>([])
  const [showCache, setShowCache] = useState(false)

  useEffect(() => {
    window.api.species.list().then(setSpeciesList).catch(() => {})
    window.api.locations.list().then(setLocationsList).catch(() => {})
    window.api.locations.listCache().then(setCacheEntries).catch(() => {})
  }, [])

  async function handleRemember(rawStr: string, locationId: number) {
    await window.api.locations.confirmMatch(rawStr, locationId)
    setRememberedThisSession(prev => new Set(prev).add(rawStr))
    // Apply to all rows in this session with the same original location string
    const locationName = locationsList.find(l => l.id === locationId)?.name
    onRowsChange(rows.map(r => {
      if ((r.originalLocation ?? r.locationName ?? '') === rawStr) {
        return { ...r, locationId, locationMatchQuality: 'cache', locationMatchName: locationName }
      }
      return r
    }))
    window.api.locations.listCache().then(setCacheEntries).catch(() => {})
  }

  async function handleDeleteCacheEntry(rawString: string) {
    await window.api.locations.deleteCacheEntry(rawString)
    setRememberedThisSession(prev => { const s = new Set(prev); s.delete(rawString); return s })
    window.api.locations.listCache().then(setCacheEntries).catch(() => {})
  }

  function updateRow(i: number, changes: Partial<ParsedSighting>) {
    onRowsChange(rows.map((r, idx) => idx === i ? { ...r, ...changes } : r))
  }

  function handleSpeciesChange(i: number, commonName: string) {
    if (!commonName) {
      updateRow(i, { commonName: '', scientificName: '', family: undefined, speciesMatchQuality: 'none' })
      return
    }
    const sp = speciesList.find(s => s.commonName === commonName)
    if (sp) {
      updateRow(i, {
        commonName: sp.commonName,
        scientificName: sp.scientificName,
        family: sp.family ?? undefined,
        speciesMatchQuality: 'manual',
      })
    }
  }

  const visibleCols = COLS.filter(({ key, alwaysShow }) => alwaysShow || rows.some(r => r[key] != null && r[key] !== ''))

  // Per-quality counts for stats display, ordered by label map key order
  function qualityCounts(
    labelMap: Record<string, unknown>,
    getter: (r: ParsedSighting) => string | undefined
  ): [string, number][] {
    const counts: Record<string, number> = {}
    for (const r of rows) counts[getter(r) ?? 'none'] = (counts[getter(r) ?? 'none'] ?? 0) + 1
    return Object.keys(labelMap)
      .filter(q => counts[q] != null)
      .map(q => [q, counts[q]] as [string, number])
  }

  const speciesBreakdown  = qualityCounts(QUALITY_LABEL,          r => r.speciesMatchQuality)
  const locationBreakdown = qualityCounts(LOCATION_QUALITY_LABEL, r => r.locationMatchQuality)

  // Unique quality values present in data, for filter dropdowns
  const speciesQualities  = speciesBreakdown.map(([q]) => q)
  const locationQualities = locationBreakdown.map(([q]) => q)

  // Filtered rows — keep original index for updateRow
  const displayRows = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => {
      if (speciesFilter  && (row.speciesMatchQuality  ?? 'none') !== speciesFilter)  return false
      if (locationFilter && (row.locationMatchQuality ?? 'none') !== locationFilter) return false
      return true
    })

  const unmatched = rows.filter(r => !r.speciesMatchQuality || r.speciesMatchQuality === 'none').length

  async function commit(force = false) {
    if (!force && unmatched > 0) {
      setConfirmingUnmatched(true)
      return
    }
    setConfirmingUnmatched(false)
    setBusy(true)
    setError(null)
    const finalRows = rows.map(r =>
      (!r.speciesMatchQuality || r.speciesMatchQuality === 'none')
        ? { ...r, commonName: 'Unknown' }
        : r
    )
    try {
      await window.api.import.commitStaged(finalRows, filename, format, mapping, filePath)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function renderCell(row: ParsedSighting, col: Col, i: number): React.ReactNode {
    const val = row[col.key]

    if (col.editable === 'species') {
      return (
        <select
          value={String(val ?? '')}
          onChange={e => handleSpeciesChange(i, e.target.value)}
          style={selectStyle}
        >
          <option value="">(none)</option>
          {speciesList.map(sp => (
            <option key={sp.id ?? sp.commonName} value={sp.commonName}>{sp.commonName}</option>
          ))}
        </select>
      )
    }

    if (col.editable === 'location') {
      const candidates: LocationCandidate[] = row.locationCandidates ?? []
      const currentId = typeof val === 'number' ? val : undefined
      const rawStr = row.originalLocation ?? row.locationName ?? ''
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <select
            value={currentId ?? ''}
            onChange={e => {
              const id = e.target.value ? parseInt(e.target.value, 10) : undefined
              updateRow(i, { locationId: id, locationMatchQuality: id ? 'manual' : 'none' } as Partial<ParsedSighting>)
            }}
            style={selectStyle}
          >
            <option value="">(none)</option>
            {candidates.length > 0 && (
              <optgroup label="Suggested">
                {candidates.map(c => (
                  <option key={c.locationId} value={c.locationId}>
                    {c.name}{c.matchName && c.matchName !== c.name ? ` — ${c.matchName}` : ''}{c.distanceKm ? ` (${c.distanceKm.toFixed(1)}km)` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="All locations">
              {locationsList
                .filter(l => !candidates.some(c => c.locationId === l.id))
                .map(l => <option key={l.id} value={l.id}>{l.name}</option>)
              }
            </optgroup>
          </select>
          {rawStr && currentId != null && (
            rememberedThisSession.has(rawStr)
              ? <span style={{ fontSize: 11, color: '#1a7f3c', fontWeight: 600 }}>✓ Remembered</span>
              : <button
                  title="Remember this match for future imports"
                  onClick={() => handleRemember(rawStr, currentId)}
                  style={btnRemember}
                >
                  Remember
                </button>
          )}
        </div>
      )
    }

    if (col.editable === 'textarea') {
      return (
        <textarea
          value={String(val ?? '')}
          onChange={e => updateRow(i, { [col.key]: e.target.value } as Partial<ParsedSighting>)}
          rows={2}
          style={{ ...inputStyle, width: 220, resize: 'vertical' }}
        />
      )
    }

    if (col.editable === 'text') {
      return (
        <input
          type="text"
          value={String(val ?? '')}
          onChange={e => updateRow(i, { [col.key]: e.target.value } as Partial<ParsedSighting>)}
          style={inputStyle}
        />
      )
    }

    if (col.editable === 'number') {
      return (
        <input
          type="number"
          value={val != null ? String(val) : ''}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            updateRow(i, { [col.key]: isNaN(n) ? undefined : n } as Partial<ParsedSighting>)
          }}
          style={{ ...inputStyle, width: 70 }}
        />
      )
    }

    return String(val ?? '')
  }

  const isFiltered = speciesFilter !== '' || locationFilter !== ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 8 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={btnSecondary} disabled={busy}>← Back</button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <QualityBreakdown
            label="Species"
            counts={speciesBreakdown}
            labelMap={QUALITY_LABEL}
            activeFilter={speciesFilter}
            onFilter={setSpeciesFilter}
          />
          <QualityBreakdown
            label="Location"
            counts={locationBreakdown}
            labelMap={LOCATION_QUALITY_LABEL}
            activeFilter={locationFilter}
            onFilter={setLocationFilter}
          />
        </div>

        {isFiltered && (
          <span style={{ fontSize: 12, color: '#1864ab' }}>
            Showing {displayRows.length} of {rows.length} rows
            {' '}
            <button onClick={() => { setSpeciesFilter(''); setLocationFilter('') }} style={{ ...btnSecondary, padding: '2px 8px', fontSize: 11 }}>
              Clear filters
            </button>
          </span>
        )}

        {warnings.length > 0 && (
          <details style={{ fontSize: 12, color: '#7c5700' }}>
            <summary>{warnings.length} warnings</summary>
            <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </details>
        )}
        <button onClick={() => commit()} disabled={busy} style={{ ...btnPrimary, marginLeft: 'auto' }}>
          {busy ? 'Saving…' : 'Save to database'}
        </button>
      </div>

      {confirmingUnmatched && (
        <div style={{ padding: '10px 14px', background: '#fff3bf', border: '1px solid #f59f00', borderRadius: 4, fontSize: 13, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            <strong>{unmatched} unmatched {unmatched === 1 ? 'record' : 'records'}</strong> will be saved with Common Name set to <em>"Unknown"</em>. Go back to assign species, or proceed.
          </span>
          <button onClick={() => commit(true)} style={btnWarning}>Proceed</button>
          <button onClick={() => setConfirmingUnmatched(false)} style={btnSecondary}>Cancel</button>
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 12px', background: '#ffe3e3', borderRadius: 4, color: '#c0392b', fontSize: 13, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Remembered matches panel */}
      <div style={{ flexShrink: 0 }}>
        <button
          onClick={() => setShowCache(c => !c)}
          style={{ ...btnSecondary, fontSize: 12, padding: '4px 10px' }}
        >
          {showCache ? '▾' : '▸'} Remembered location matches ({cacheEntries.length})
        </button>
        {showCache && (
          <div style={{ marginTop: 6, border: '1px solid #dee2e6', borderRadius: 4, overflow: 'hidden' }}>
            {cacheEntries.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 12, color: '#888', fontStyle: 'italic' }}>No remembered matches yet.</div>
            ) : (
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={cacheTh}>Original location string</th>
                    <th style={cacheTh}>Matched to</th>
                    <th style={cacheTh}>When</th>
                    <th style={cacheTh}></th>
                  </tr>
                </thead>
                <tbody>
                  {cacheEntries.map((entry, i) => (
                    <tr key={entry.rawString} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
                      <td style={cacheTd}>{entry.rawString}</td>
                      <td style={cacheTd}>{entry.locationName ?? '—'}</td>
                      <td style={{ ...cacheTd, whiteSpace: 'nowrap' }}>{formatCacheDate(entry.confirmedAt)}</td>
                      <td style={cacheTd}>
                        <button
                          onClick={() => handleDeleteCacheEntry(entry.rawString)}
                          title="Remove this remembered match"
                          style={{ ...btnRemember, background: '#ffe3e3', color: '#c0392b', borderColor: '#ffa8a8' }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Review table */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th style={th}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>Species match</span>
                  <select
                    value={speciesFilter}
                    onChange={e => setSpeciesFilter(e.target.value)}
                    style={filterSelect}
                  >
                    <option value="">All</option>
                    {speciesQualities.map(q => (
                      <option key={q} value={q}>{QUALITY_LABEL[q]?.text ?? q}</option>
                    ))}
                  </select>
                </div>
              </th>
              <th style={th}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>Location match</span>
                  <select
                    value={locationFilter}
                    onChange={e => setLocationFilter(e.target.value)}
                    style={filterSelect}
                  >
                    <option value="">All</option>
                    {locationQualities.map(q => (
                      <option key={q} value={q}>{LOCATION_QUALITY_LABEL[q]?.text ?? q}</option>
                    ))}
                  </select>
                </div>
              </th>
              {visibleCols.map(({ key, label }) => <th key={key} style={th}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {displayRows.map(({ row, i }) => {
              const q = row.speciesMatchQuality ?? 'none'
              const badge = QUALITY_LABEL[q] ?? QUALITY_LABEL['none']
              const lq = row.locationMatchQuality ?? 'none'
              const lbadge = LOCATION_QUALITY_LABEL[lq] ?? LOCATION_QUALITY_LABEL['none']
              return (
                <tr key={i} style={{ background: i % 2 ? '#f8f9fa' : '#fff' }}>
                  <td style={td}>
                    <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600, color: badge.color, background: badge.bg }}>
                      {badge.text}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600, color: lbadge.color, background: lbadge.bg }}>
                      {lbadge.text}
                    </span>
                  </td>
                  {visibleCols.map(col => (
                    <td key={col.key} style={col.editable ? { ...td, padding: '3px 6px' } : td}>
                      {renderCell(row, col, i)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 10px', background: '#f1f3f5', border: '1px solid #dee2e6', textAlign: 'left', position: 'sticky', top: 0, verticalAlign: 'top' }
const td: React.CSSProperties = { padding: '5px 10px', border: '1px solid #dee2e6' }
const selectStyle: React.CSSProperties = { fontSize: 12, padding: '2px 4px', width: 200, maxWidth: 200 }
const filterSelect: React.CSSProperties = { fontSize: 11, padding: '1px 3px', width: 120, border: '1px solid #ced4da', borderRadius: 3, background: '#fff', fontWeight: 400 }
const inputStyle: React.CSSProperties = { fontSize: 12, padding: '2px 4px', width: 140, border: '1px solid #ced4da', borderRadius: 3 }
const btnPrimary: React.CSSProperties = { padding: '7px 16px', background: '#1c7ed6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }
const btnSecondary: React.CSSProperties = { padding: '7px 12px', background: '#f1f3f5', border: '1px solid #dee2e6', borderRadius: 4, cursor: 'pointer', fontSize: 13 }
const btnWarning: React.CSSProperties = { padding: '5px 14px', background: '#f59f00', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }
const btnRemember: React.CSSProperties = { padding: '2px 8px', background: '#e7f5ff', color: '#1864ab', border: '1px solid #74c0fc', borderRadius: 3, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }
const cacheTh: React.CSSProperties = { padding: '5px 10px', background: '#f1f3f5', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 600 }
const cacheTd: React.CSSProperties = { padding: '4px 10px', border: '1px solid #dee2e6' }
