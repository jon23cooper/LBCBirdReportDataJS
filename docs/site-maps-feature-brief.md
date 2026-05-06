# Site Maps Web App — Feature Brief for Claude Code

## Overview

Add an interactive site maps page to the existing LBC Bird Report web app (`data-editor`). The page should display recording locations on a map, allow users to explore each site, and show sighting statistics for each location.

---

## Existing System Context

### Repos and key paths

| Item | Path |
|------|------|
| Web app | `/Users/jon/Documents/data-editor` |
| Electron app | `/Users/jon/Documents/LBCBirdReportDataJS` |
| Pi API source | `~/lbc-api/src/index.ts` on Pi |
| Pi SSH | `jon_cooper@100.95.100.85` |
| Pi API port | `3000` |
| Web app port | `8080` (static files served by PM2) |

### Web app stack

- React + Vite, no component library
- Plain inline styles using CSS variables (`--surface`, `--border`, `--text`, `--accent`, `--bg`, `--radius`, `--font-mono`)
- Auth: JWT — use `apiFetch()` in `src/lib/api.js` for all API calls (adds Bearer token automatically)
- Routing: simple `useState` page switching in `src/App.jsx` — add `'maps'` to the Page type and nav array
- Deploy: `./deploy.sh` from `/Users/jon/Documents/data-editor`

### Pi API stack

- Hono + Node.js + node-postgres, TypeScript
- All endpoints in one file: `~/lbc-api/src/index.ts`
- Auth middleware pattern: `app.get('/path', requireAuth, async (c) => { const user = c.get('user') ... })`
- After changes: `npx tsc && pm2 restart lbc-api`

---

## Location Data Schema

### Postgres `locations` table (already populated)

```
id            INTEGER PRIMARY KEY
name          TEXT NOT NULL
grid_ref      TEXT
lat           REAL  -- point latitude
lon           REAL  -- point longitude
centroid_lat  REAL  -- centroid of polygon
centroid_lon  REAL
geometry      TEXT  -- GeoJSON string (Polygon or MultiPolygon)
country       TEXT
region        TEXT
notes         TEXT
```

The `geometry` column is a JSON **string** — always `JSON.parse()` it before passing to Leaflet.

Sightings have `location_id` FK to locations and an `is_deleted` soft-delete flag.

---

## Existing API Endpoints

| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/locations` | JWT | All locations with all columns |
| GET | `/sightings?location_name=X&limit=N` | JWT | Sightings filtered by location |

---

## Feature Requirements

### 1. New nav item

Add **Maps** to the nav in `src/App.jsx`.

### 2. MapsPage (`src/pages/MapsPage.jsx`)

**Map display:**
- Use `leaflet` + `react-leaflet` (add to `package.json`)
- Import Leaflet CSS: `import 'leaflet/dist/leaflet.css'`
- Leaflet default marker icons break with Vite — use `L.circleMarker` or a custom icon
- Base tiles: OpenStreetMap or Stadia Maps (key available as `import.meta.env.VITE_STADIA_API_KEY`)
- Centre on Lincolnshire UK: `[53.2, -0.5]`, zoom 9
- Map height: fill viewport minus navbar

**Location rendering:**
- Locations with `geometry` → render as GeoJSON polygon (semi-transparent `--accent` fill at ~20% opacity)
- Locations with only `lat`/`lon` → render as circle marker
- Use `centroid_lat`/`centroid_lon` as label/tooltip anchor where available

**Click interaction:**
- Clicking a location opens a **sidebar panel** (not a modal) on the right showing:
  - Name, grid reference, region, country, notes
  - Total record count, first and last record dates
  - List of species recorded there
- Sidebar dismisses on X click or clicking the map

### 3. New Pi API endpoint

Add to `~/lbc-api/src/index.ts` before the `const PORT` line:

```typescript
app.get('/locations/:id/stats', requireAuth, async (c) => {
  const id = c.req.param('id')
  const [loc, stats] = await Promise.all([
    pool.query('SELECT name, grid_ref, region, country, notes FROM locations WHERE id = $1', [id]),
    pool.query(
      `SELECT COUNT(*) as total_records,
              MIN(to_char(date, 'YYYY-MM-DD')) as first_record,
              MAX(to_char(date, 'YYYY-MM-DD')) as last_record,
              array_agg(DISTINCT common_name ORDER BY common_name)
                FILTER (WHERE common_name IS NOT NULL) as species
       FROM sightings WHERE location_id = $1 AND is_deleted = false`,
      [id]
    )
  ])
  return c.json({ location_id: Number(id), ...loc.rows[0], ...stats.rows[0] })
})
```

### 4. API client addition

Add to `src/lib/api.js`:

```javascript
export const locations = {
  async list() {
    return apiFetch('/locations')
  },
  async stats(id) {
    return apiFetch(`/locations/${id}/stats`)
  },
}
```

---

## Style Reference

See `src/pages/SpeciesPage.jsx` and `src/pages/DataPage.jsx` for patterns. CSS variables:

| Variable | Usage |
|----------|-------|
| `--surface` | Card / panel background |
| `--bg` | Page background |
| `--border` | Border colour |
| `--text` | Primary text |
| `--text-dim` | Secondary text |
| `--accent` | Blue highlight (`#1c7ed6`) |
| `--danger` | Red (`#dc2626`) |
| `--radius` | Border radius |
| `--font-mono` | Monospace font |

---

## Checklist for Claude Code

- [ ] `npm install leaflet react-leaflet` in `/Users/jon/Documents/data-editor`
- [ ] Add `GET /locations/:id/stats` endpoint to Pi API, compile and restart
- [ ] Add `locations` export to `src/lib/api.js`
- [ ] Create `src/pages/MapsPage.jsx`
- [ ] Add `'maps'` page to `src/App.jsx` nav and page switch
- [ ] Run `./deploy.sh` to deploy to Pi
- [ ] Test at `http://100.95.100.85:8080`
