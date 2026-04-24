import { useState } from 'react'
import ImportPage from './pages/ImportPage'
import SightingsPage from './pages/SightingsPage'
import MapPage from './pages/MapPage'
import LocationsPage from './pages/LocationsPage'
import ExportPage from './pages/ExportPage'
import EditPage, { type EditData } from './pages/EditPage'

type Page = 'import' | 'sightings' | 'map' | 'locations' | 'export' | 'edit'

const NAV: { id: Page; label: string }[] = [
  { id: 'import',    label: 'Import' },
  { id: 'sightings', label: 'Sightings' },
  { id: 'map',       label: 'Map' },
  { id: 'locations', label: 'Locations' },
  { id: 'export',    label: 'Export' },
]

export default function App(): JSX.Element {
  const [page, setPage] = useState<Page>('import')
  const [editData, setEditData] = useState<EditData | null>(null)

  function handleValidationFailed(data: EditData) {
    setEditData(data)
    setPage('edit')
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
      </nav>

      <main style={{ flex: 1, overflow: page === 'edit' ? 'hidden' : 'auto', padding: 24, display: 'flex', flexDirection: 'column' }}>
        {page === 'import'    && <ImportPage onValidationFailed={handleValidationFailed} />}
        {page === 'sightings' && <SightingsPage />}
        {page === 'map'       && <MapPage />}
        {page === 'locations' && <LocationsPage />}
        {page === 'export'    && <ExportPage />}
        {page === 'edit' && editData && (
          <EditPage
            editData={editData}
            onSuccess={() => { setEditData(null); setPage('sightings') }}
            onCancel={() => setPage('import')}
          />
        )}
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
