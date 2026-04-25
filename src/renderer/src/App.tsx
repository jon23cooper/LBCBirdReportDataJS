import { useState, Component, type ReactNode } from 'react'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#c0392b', fontFamily: 'monospace', overflowY: 'auto' }}>
          <strong>Render error — please report this</strong>
          <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#555' }}>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
import ImportPage from './pages/ImportPage'
import SightingsPage from './pages/SightingsPage'
import MapPage from './pages/MapPage'
import LocationsPage from './pages/LocationsPage'
import SpeciesPage from './pages/SpeciesPage'
import ExportPage from './pages/ExportPage'
import HistoryPage from './pages/HistoryPage'
import EditPage, { type EditData } from './pages/EditPage'
import StagingPage from './pages/StagingPage'
import type { StagingData, ParsedSighting } from '../../shared/types'

type Page = 'import' | 'sightings' | 'map' | 'locations' | 'species' | 'export' | 'history' | 'edit' | 'staging'

const STAGING_SORT_ORDER: Record<string, number> = {
  'none': 0, 'regex-scientific': 1, 'regex-common': 1, 'manual': 2, 'exact-scientific': 3, 'exact-common': 3,
}

const NAV: { id: Page; label: string }[] = [
  { id: 'import',    label: 'Import' },
  { id: 'history',   label: 'History' },
  { id: 'sightings', label: 'Sightings' },
  { id: 'map',       label: 'Map' },
  { id: 'locations', label: 'Locations' },
  { id: 'species',   label: 'Species' },
  { id: 'export',    label: 'Export' },
]

export default function App(): JSX.Element {
  const [page, setPage] = useState<Page>('import')
  const [editData, setEditData] = useState<EditData | null>(null)
  const [stagingData, setStagingData] = useState<StagingData | null>(null)
  const [stagingRows, setStagingRows] = useState<ParsedSighting[] | null>(null)
  const [stagingFrom, setStagingFrom] = useState<'import' | 'edit'>('import')

  function handleValidationFailed(data: EditData) {
    setEditData(data)
    setPage('edit')
  }

  function handleValidated(data: StagingData, from: 'import' | 'edit') {
    const sorted = [...data.rows].sort((a, b) =>
      (STAGING_SORT_ORDER[a.speciesMatchQuality ?? 'none'] ?? 0) - (STAGING_SORT_ORDER[b.speciesMatchQuality ?? 'none'] ?? 0)
    )
    setStagingData(data)
    setStagingRows(sorted)
    setStagingFrom(from)
    setPage('staging')
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <nav style={navStyle}>
        <div style={{ padding: '16px 12px', fontWeight: 700, fontSize: 15, borderBottom: '1px solid #dee2e6' }}>
          LBC Bird Report
        </div>
        {NAV.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            style={{ ...navBtn, background: page === id ? '#e7f5ff' : 'transparent', fontWeight: page === id ? 600 : 400 }}
          >
            {label}
          </button>
        ))}
        {page === 'edit' && (
          <button style={{ ...navBtn, background: '#e7f5ff', fontWeight: 600, color: '#c0392b' }}>
            Edit data
          </button>
        )}
        {stagingData && (
          <button
            onClick={() => setPage('staging')}
            style={{ ...navBtn, background: page === 'staging' ? '#e7f5ff' : 'transparent', fontWeight: page === 'staging' ? 600 : 400, color: '#1c7ed6' }}
          >
            Review
          </button>
        )}
      </nav>

      <main style={{ flex: 1, overflow: (page === 'edit' || page === 'staging') ? 'hidden' : 'auto', padding: 24, display: 'flex', flexDirection: 'column' }}>
        <ErrorBoundary>
        {page === 'import'    && <ImportPage onValidationFailed={handleValidationFailed} onValidated={d => handleValidated(d, 'import')} />}
        {page === 'history'   && <HistoryPage />}
        {page === 'sightings' && <SightingsPage />}
        {page === 'map'       && <MapPage />}
        {page === 'locations' && <LocationsPage />}
        {page === 'species'   && <SpeciesPage />}
        {page === 'export'    && <ExportPage />}
        {page === 'edit' && editData && (
          <EditPage
            editData={editData}
            onValidated={d => handleValidated(d, 'edit')}
            onCancel={() => setPage('import')}
          />
        )}
        {page === 'staging' && stagingData && stagingRows && (
          <StagingPage
            stagingData={stagingData}
            rows={stagingRows}
            onRowsChange={setStagingRows}
            onBack={() => setPage(stagingFrom)}
            onSuccess={() => { setStagingData(null); setStagingRows(null); setPage('sightings') }}
          />
        )}
        </ErrorBoundary>
      </main>
    </div>
  )
}

const navStyle: React.CSSProperties = {
  width: 180,
  borderRight: '1px solid #dee2e6',
  display: 'flex',
  flexDirection: 'column',
  background: '#fff',
  flexShrink: 0,
}

const navBtn: React.CSSProperties = {
  padding: '10px 16px',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 14,
  borderRadius: 0,
}
