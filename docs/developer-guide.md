# LBC Bird Report — Developer Guide

## Contents

1. [Architecture overview](#architecture-overview)
2. [Project structure](#project-structure)
3. [Technology stack](#technology-stack)
4. [Development setup](#development-setup)
5. [macOS build notes](#macos-build-notes)
6. [Environment variables](#environment-variables)
7. [Database schema](#database-schema)
8. [IPC API](#ipc-api)
9. [Import flow](#import-flow)
10. [Location matching](#location-matching)
11. [Adding a new importer format](#adding-a-new-importer-format)
12. [Adding fields to the schema](#adding-fields-to-the-schema)
13. [Building for distribution](#building-for-distribution)

---

## Architecture overview

The app follows the standard Electron three-process model:

```text
┌─────────────────────────────────────────────┐
│  Main process  (Node.js / src/main/)         │
│  • SQLite database (better-sqlite3 + Drizzle)│
│  • File I/O, spreadsheet parsing            │
│  • Location matching (turf.js)              │
│  • IPC handlers                             │
└────────────────┬────────────────────────────┘
                 │ contextBridge / ipcRenderer
┌────────────────▼────────────────────────────┐
│  Preload script  (src/preload/)              │
│  • Exposes window.api to renderer            │
└────────────────┬────────────────────────────┘
                 │ window.api.*
┌────────────────▼────────────────────────────┐
│  Renderer  (React / src/renderer/)           │
│  • Import wizard + staging review           │
│  • Edit data screen                         │
│  • Sightings table                          │
│  • Import history                           │
│  • Location editor + Leaflet map            │
│  • Species manager                          │
│  • Export page                              │
└─────────────────────────────────────────────┘
```

The renderer never touches the filesystem or database directly — all data access goes through IPC calls to the main process.

---

## Project structure

```text
src/
├── main/                   Main process
│   ├── index.ts            Entry point — creates window, initialises DB
│   ├── db/
│   │   ├── index.ts        Database initialisation and migrations
│   │   └── schema.ts       Drizzle table definitions
│   ├── ipc/
│   │   └── index.ts        All ipcMain.handle() registrations
│   ├── importers/
│   │   ├── index.ts        readSpreadsheet() — CSV/XLSX/ODS reader
│   │   ├── normalise.ts    Row normalisation against a FieldMapping
│   │   └── parseDate.ts    Multi-format date parser
│   └── locations/
│       └── match.ts        Spatial + regex location matching
│
├── preload/
│   └── index.ts            Exposes window.api via contextBridge
│
├── renderer/
│   ├── index.html
│   └── src/
│       ├── main.tsx        React entry point
│       ├── App.tsx         Navigation shell + staging state
│       ├── env.d.ts        window.api type declarations
│       └── pages/
│           ├── ImportPage.tsx
│           ├── EditPage.tsx    Spreadsheet editor for fixing validation failures
│           ├── StagingPage.tsx
│           ├── HistoryPage.tsx
│           ├── SightingsPage.tsx
│           ├── LocationsPage.tsx
│           ├── SpeciesPage.tsx
│           └── ExportPage.tsx
│
└── shared/
    └── types.ts            Types shared between main and renderer

data/                       Reference data files (committed)
  locations.geojson         Location polygon dataset
  locations_regex.csv       Location name regex patterns
docs/                       This documentation
release/                    electron-builder output (gitignored)
out/                        electron-vite build output (gitignored)
```

---

## Technology stack

| Layer | Library | Notes |
| --- | --- | --- |
| Desktop shell | [Electron](https://electronjs.org) v32 | |
| Build tool | [electron-vite](https://electron-vite.org) v3 | Vite-based, handles main + preload + renderer |
| Packaging | [electron-builder](https://www.electron.build) v25 | Creates signed .app |
| UI framework | [React](https://react.dev) v18 | No component library — plain inline styles |
| Database | [SQLite](https://sqlite.org) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | Single file in `~/Library/Application Support` |
| ORM | [Drizzle ORM](https://orm.drizzle.team) | Type-safe queries; raw SQLite used for performance-critical reads |
| Spreadsheet parsing | [xlsx](https://github.com/SheetJS/sheetjs) | Handles CSV, XLSX, XLS and ODS |
| Spreadsheet editor | [jspreadsheet-ce](https://bossanova.uk/jspreadsheet/v4/) | Edit Data screen |
| Mapping | [Leaflet](https://leafletjs.com) v1.9 | Interactive polygon display and editing |
| Polygon editing | [@geoman-io/leaflet-geoman-free](https://geoman.io) v2.19 | Vertex dragging for polygon editing |
| Spatial operations | [@turf/turf](https://turfjs.org) v7 | Point-in-polygon, centroid, distance |
| Tile provider | OpenStreetMap.DE | No API key required |
| Language | TypeScript 5.7 | Strict mode throughout |

---

## Development setup

### Prerequisites

- macOS 12+ (Apple Silicon or Intel)
- Node.js 18+
- An Apple Developer account (required for code signing — see macOS build notes)

### Install

```bash
git clone https://github.com/jon23cooper/LBCBirdReportDataJS.git
cd LBCBirdReportDataJS
npm install
```

### Run

```bash
npm run dev
```

This compiles main + preload + renderer, packages a signed `.app` via `electron-builder --dir`, copies it into `/Applications`, and re-signs it. When the build finishes:

```text
Build complete — open LBC Bird Report from Spotlight or Applications
```

Open from Spotlight (`⌘ Space → LBC Bird Report`) or the Applications folder.

**Hot-reload is not available** — see macOS build notes below.

### Typecheck

```bash
npm run typecheck
```

---

## macOS build notes

### Why `npm run dev` builds a full app instead of using electron-vite's dev server

On macOS 15 (Sequoia) with Apple Silicon, the ad-hoc-signed Electron binary that ships in the `electron` npm package cannot register its internal module system when launched directly from the terminal. The workaround is to package the app with electron-builder, which signs it with the developer's Apple Development certificate.

**Practical consequence:** Each code change requires a rebuild cycle (~15–20 seconds). Edit your code, run `npm run dev`, then open the app from Spotlight or Applications.

### Code signing

electron-builder automatically uses the first available Apple Development certificate in your Keychain. If you have multiple certificates, set `CSC_NAME` in your environment:

```bash
CSC_NAME="Apple Development: Your Name (TEAMID)" npm run dist
```

---

## Environment variables

Create a `.env` file at the project root (gitignored). Variables prefixed `VITE_` are injected into the renderer bundle at build time.

| Variable | Purpose |
| --- | --- |
| `VITE_STADIA_API_KEY` | Optional Stadia Maps API key — appended to the tile URL in `LocationsPage.tsx` if present |

---

## Database schema

Defined in [src/main/db/schema.ts](../src/main/db/schema.ts). Migrations are applied inline in [src/main/db/index.ts](../src/main/db/index.ts) on startup.

### `locations`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | Auto-increment |
| `name` | TEXT NOT NULL | Unique — used as the match key |
| `grid_ref` | TEXT | OS grid reference |
| `lat` | REAL | Manual point lat (WGS84) |
| `lon` | REAL | Manual point lon (WGS84) |
| `centroid_lat` | REAL | Computed centroid of polygon |
| `centroid_lon` | REAL | Computed centroid of polygon |
| `geometry` | TEXT | GeoJSON Polygon geometry as JSON string |
| `country` | TEXT | |
| `region` | TEXT | |
| `notes` | TEXT | |

### `location_regex`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `site_name` | TEXT NOT NULL | FK (by name) to `locations.name` |
| `regex` | TEXT NOT NULL | JavaScript-compatible regex pattern |
| `match_name` | TEXT | The place name this pattern matches |

### `location_match_cache`

| Column | Type | Notes |
| --- | --- | --- |
| `raw_string` | TEXT PK | The original location string from a sighting |
| `location_id` | INTEGER | FK to `locations.id` |
| `confirmed_at` | TEXT | ISO 8601 timestamp |

### `sightings`

Full column list in [src/main/db/schema.ts](../src/main/db/schema.ts). Key fields:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `import_batch_id` | INTEGER FK | → `import_batches.id` |
| `location_id` | INTEGER FK | → `locations.id` (nullable) |
| `species` | TEXT NOT NULL | Resolved species name |
| `common_name` | TEXT | |
| `scientific_name` | TEXT | |
| `family` | TEXT | |
| `date` | TEXT NOT NULL | ISO 8601 `YYYY-MM-DD` |
| `count` | INTEGER | |
| `observer` | TEXT | |
| `dataset` | TEXT | Batch-level dataset label |
| `lbc_id` | TEXT | Sequential LBC identifier |
| `raw_data` | TEXT | Original import row as JSON |

### `species`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `common_name` | TEXT NOT NULL | |
| `common_name_regex` | TEXT | Regex for matching common name variants |
| `scientific_name` | TEXT NOT NULL | |
| `scientific_name_regex` | TEXT | Regex for matching scientific name variants |
| `family` | TEXT | |

### `import_batches`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `filename` | TEXT NOT NULL | Original filename |
| `format` | TEXT NOT NULL | `csv` / `xlsx` / `ods` |
| `imported_at` | TEXT NOT NULL | ISO 8601 timestamp |
| `row_count` | INTEGER | |
| `field_mapping` | TEXT | JSON field mapping used at import |
| `stored_file` | TEXT | Absolute path to the moved source file in the `imports/` directory |

### `settings`

Key-value store. Currently holds `lbc_sequence` (integer counter for LBC ID generation).

---

## IPC API

All communication goes through `window.api`, defined in [src/preload/index.ts](../src/preload/index.ts) and typed in [src/renderer/src/env.d.ts](../src/renderer/src/env.d.ts).

### `window.api.import`

| Method | Description |
| --- | --- |
| `openFile()` | File picker → `{ path, sheets, headers, preview }` or `null` |
| `readSheet(filePath, sheetName, skipRows)` | Re-read headers + 5-row preview for a different sheet or skip value |
| `validate(filePath, mapping, sheetName?, skipRows?, batchOptions?)` | Parse and validate all rows → `{ status: 'ok', rows, warnings }` or `{ status: 'validation-failed', headers, allRows, failures }` |
| `validateRows(rows, mapping, batchOptions?)` | Same but from already-loaded rows (used by EditPage for re-validation after edits) |
| `commitStaged(rows, filename, format, mapping, sourceFilePath?)` | Write validated rows to the database, move source file to imports directory → `{ imported }` |

### `window.api.sightings`

| Method | Description |
| --- | --- |
| `list()` | All rows as `Sighting[]`, with `locationMatchName` joined from the `locations` table |
| `delete(id)` | Delete a single sighting record |
| `update(id, changes)` | Update editable fields on a sighting record |

### `window.api.locations`

| Method | Description |
| --- | --- |
| `list()` | All locations (excludes geometry for performance) as `Location[]` |
| `listGeometries()` | All locations with geometry — `{ id, name, geometry }[]` — used for map rendering |
| `get(id)` | Single location including geometry |
| `upsert(data)` | Insert or update |
| `openGeojsonFile()` | File picker → path or `null` |
| `importGeojson(filePath)` | Import polygons, compute centroids → `{ imported, errors }` |
| `openRegexCsvFile()` | File picker → path or `null` |
| `importRegexCsv(filePath)` | Replace all regex patterns from CSV → `{ imported, errors }` |
| `confirmMatch(rawString, locationId)` | Write to match cache |
| `listCache()` | All cache entries as `{ rawString, locationName, confirmedAt }[]` |
| `listCacheForLocation(locationId)` | Cache entries for a specific location as `{ rawString, confirmedAt }[]` |
| `deleteCacheEntry(rawString)` | Remove a single entry from the match cache |
| `listRegex(siteName)` | Regex patterns for one site |
| `saveRegex(siteName, rows)` | Replace regex patterns for one site |

### `window.api.species`

| Method | Description |
| --- | --- |
| `list()` | All species as `SpeciesRecord[]` |
| `upsert(record)` | Insert or update |
| `delete(id)` | Delete a species record by id |
| `openCsvFile()` | File picker → path or `null` |
| `importCsv(filePath)` | Import species list from CSV → `{ imported, errors }` |

### `window.api.export`

`ExportFilters` (all fields optional):

```ts
interface ExportFilters {
  dateFrom?: string   // ISO 8601
  dateTo?: string     // ISO 8601
  dataset?: string    // exact match
  locationId?: number
  observer?: string   // LIKE %value%
  species?: string    // LIKE %value%
}
```

| Method | Description |
| --- | --- |
| `datasets()` | Distinct dataset labels present in the database → `string[]` |
| `count(filters)` | Count of matching sighting records → `number` |
| `xlsx(filters)` | Save dialog → write `.xlsx` file of matching sightings → path or `null` |
| `sql(filters)` | Save dialog → write PostgreSQL SQL file of matching sightings + all locations → path or `null` |

### `window.api.batches`

| Method | Description |
| --- | --- |
| `list()` | All import batches as `{ id, filename, format, importedAt, rowCount, storedFile }[]` |
| `delete(id)` | Delete the batch and all its sighting records |
| `revealFile(storedFile)` | Open the stored file's parent folder in Finder (`shell.showItemInFolder`) |
| `openFile(storedFile)` | Open the stored file in its default application (`shell.openPath`) |
| `locateFile(id)` | File picker to manually associate a file with a batch → stores the chosen path and returns it, or `null` |

---

## Import flow

The full import pipeline from file selection to database commit:

```text
ImportPage
  ↓ openFile / readSheet         (IPC: import:open-file / import:read-sheet)
  ↓ validate                     (IPC: import:validate)
       ↓ validation-failed
           → EditPage            (jspreadsheet-ce editor)
               ↓ validateRows    (IPC: import:validate-rows)
               ↓ ok
       ↓ ok
  → StagingPage                  (review, edit species/location overrides)
       ↓ commitStaged            (IPC: import:commit-staged)
           • assigns LBC IDs
           • moves source file to imports/
           • inserts import_batches + sightings rows
  → SightingsPage
```

### EditPage details

`EditPage` receives an `EditData` object containing the failed rows and original mapping. It renders a jspreadsheet-ce grid with:

- A read-only **Status** column showing the failure reason or ✓
- One editable column per mapped field
- An **Add column…** dropdown to add unmapped fields as new editable columns
- An **Open source file** button (if `filePath` is available)
- Column sorting by clicking any header

On **Re-import**, the current grid state is read via `ws.getData()`, mapped back to `Record<string, unknown>[]` using `displayCols`, and sent to `import:validate-rows`. Any extra columns added via the dropdown are merged into the extended mapping before validation. If validation succeeds, the `StagingData` (including `filePath`) is passed to `onValidated` and the user proceeds to `StagingPage`.

### Time cell handling

Excel stores time-only values (e.g. `09:30`) as fractional day serials (0–1). With `cellDates: true`, SheetJS maps these to `Date` objects based on the Excel epoch `1899-12-30`. The `datesToIso()` function in [src/main/importers/index.ts](../src/main/importers/index.ts) detects this by checking `getFullYear() <= 1899` and formats those values as `HH:MM` rather than a date string.

### Auto-mapping column names

The `autoMap` function in `ImportPage.tsx` pattern-matches source column names to standard fields. Recognised patterns include:

| Pattern | Maps to |
| --- | --- |
| `Start Time`, `First Time` | `time` |
| `End Time`, `Last Time` | `endTime` |
| `Latitude`, `Lat`, `Trip Latitude` | `lat` |
| `Longitude`, `Lon`, `Trip Longitude` | `lon` |

---

## Location matching

Matching runs at validate time in the main process ([src/main/locations/match.ts](../src/main/locations/match.ts)). For each sighting row:

1. **Exact name match** — if `locationName` is mapped and its (trimmed) value matches a location name exactly, resolve immediately with quality `confirmed`. This path skips the regex/spatial engine entirely.

2. **Match cache** — if the `originalLocation` string (Unicode-whitespace-trimmed) has been confirmed by the user before, return that `locationId` immediately with quality `confirmed`.

3. **Spatial matching** (if `lat`/`lon` are present):
   - **Point-in-polygon** — test against every location's GeoJSON polygon using `@turf/turf booleanPointInPolygon`.
   - **Centroid proximity** — if no polygon contains the point, find locations whose centroid is within 2 km.

4. **Regex name matching** (if `originalLocation` is present) — test against all patterns in `location_regex`.

5. **Quality tier** assigned:
   - `confirmed` — found in match cache or exact name match
   - `spatial-only` — spatial match with no name match
   - `name-only` — name regex match with no spatial match
   - `conflict` — spatial and name matches disagree on which site
   - `none` — no match found

6. **Candidates list** built — up to 5 candidate locations sent to the renderer for the user to choose from in the staging review.

Calling `locations.confirmMatch(rawString, locationId)` writes to the cache so future imports resolve the string instantly.

The location cache is held in memory and invalidated when locations or regex patterns are modified.

---

## Adding a new importer format

All format-specific reading is in [src/main/importers/index.ts](../src/main/importers/index.ts). To add a new format:

1. Add a `readXxx(filePath, skipRows)` function returning `{ headers: string[]; rows: RawRow[] }`.
2. Add the extension to the dispatch block in `readSpreadsheet()`.
3. Add the extension to the `filters` array in the `import:open-file` IPC handler.

---

## Adding fields to the schema

1. Add the column to the relevant table in [src/main/db/schema.ts](../src/main/db/schema.ts).
2. Add an `ALTER TABLE ... ADD COLUMN` migration in [src/main/db/index.ts](../src/main/db/index.ts).
3. Add the field to the shared types in [src/shared/types.ts](../src/shared/types.ts).
4. Update `normaliseRows()` in [src/main/importers/normalise.ts](../src/main/importers/normalise.ts) to map the new field.
5. Update `commitParsed()` in [src/main/ipc/index.ts](../src/main/ipc/index.ts) to write the new field.
6. Update `STANDARD_FIELDS` in [src/renderer/src/pages/ImportPage.tsx](../src/renderer/src/pages/ImportPage.tsx) to expose the field in the mapping UI.

---

## Building for distribution

```bash
npm run dist
```

Produces:

- `release/mac-arm64/LBC Bird Report.app` — the signed app bundle
- `release/LBC Bird Report-x.x.x-arm64.dmg` — the distributable DMG

To build for Intel Macs as well:

```bash
npx electron-builder --mac --x64 --arm64
```


---

## Pi Integration

This section covers the connection between the Electron app and the Raspberry Pi API server, including the push and sync-back workflows.

### Overview

```text
Electron App (Mac)                    Raspberry Pi
  SQLite (local)      ──push──►       Postgres 17
                      ◄─sync──        Node/Hono API (port 3000)
                                      Tailscale IP: 100.x.x.x
```

The Electron app connects to the Pi API using a shared API key (`ELECTRON_API_KEY`) stored in `.env`. This is separate from the JWT tokens used by web app users — it bypasses the JWT auth middleware and is used only for bulk operations.

### Environment variables (Electron)

Add these to `.env` at the project root:

```
VITE_STADIA_API_KEY=...         # existing
LBC_API_URL=http://100.x.x.x:3000   # Pi Tailscale IP
LBC_API_KEY=...                      # must match ELECTRON_API_KEY on the Pi
```

`LBC_API_URL` and `LBC_API_KEY` are read by the main process only — they are not `VITE_` prefixed and are never exposed to the renderer.

### Pi API authentication for Electron

Bulk operations use an `Authorization: ApiKey <key>` header rather than a JWT. This is checked directly in the relevant endpoints without going through the `requireAuth` middleware.

### Push workflow

Pushing sends records from SQLite to Postgres. It operates at the **import batch** level — only unpushed batches are sent, leaving any existing Postgres data untouched.

The `import_batches` table has a `pushed_at` column (added in migration). A batch with `pushed_at = null` has not been pushed. After a successful push, `pushed_at` is set to the current timestamp.

**Push steps:**

1. Renderer calls `window.api.sync.pushBatch(batchId)` (or `pushAllUnpushed()`)
2. Main process reads all sightings for the batch from SQLite
3. Main process sets `dataset_locked = true` in Postgres via `PUT /settings/dataset_locked`
4. Main process POSTs records to `POST /sightings/bulk-upsert` in chunks of 500
5. The API upserts each record — inserting if the `lbc_id` doesn't exist, updating if it does and the incoming `updated_at` is newer
6. Main process also pushes any locations referenced by the batch via `POST /locations`
7. On success, `pushed_at` is stamped on the batch in SQLite
8. Main process sets `dataset_locked = false` in Postgres

**Locations and species** are also pushed during the first push of a year's data — all locations from SQLite are upserted to Postgres, and the full species list is pushed to populate the Postgres species table.

### Sync-back workflow

Sync-back pulls changes made by the web team back into SQLite. It should be run at the end of report season, or at any point you want to reconcile.

**Sync-back steps:**

1. Renderer calls `window.api.sync.syncBack(sinceTimestamp)`
2. Main process sets `dataset_locked = true` in Postgres
3. Main process calls `GET /sightings/changes-since/:timestamp` — returns all sightings with `updated_at > sinceTimestamp` or `deleted_at > sinceTimestamp`
4. For each returned record:
   - If `is_deleted = true` → delete from SQLite (hard delete)
   - If `lbc_id` exists in SQLite → update the SQLite row with Postgres values (Postgres wins, as it holds the report-phase edits)
   - If `lbc_id` is null (web-created record) → call `reserveLbcSequence(1)` to assign a new ID, insert into SQLite, then PATCH the Postgres record with the assigned `lbc_id` via `PATCH /sightings/:id/assign-lbc-id`
5. The last sync timestamp is stored in the SQLite `settings` table as `last_sync_at`
6. Main process sets `dataset_locked = false`

### IPC handlers for sync

These are registered alongside the existing handlers in `src/main/ipc/index.ts`:

| IPC channel | Description |
|---|---|
| `sync:push-batch` | Push a single import batch to the Pi |
| `sync:push-all-unpushed` | Push all batches with `pushed_at = null` |
| `sync:push-locations` | Push all locations to Postgres |
| `sync:push-species` | Push all species to Postgres |
| `sync:sync-back` | Pull all Postgres changes since last sync into SQLite |
| `sync:get-status` | Returns `{ pushedBatches, unpushedBatches, lastSyncAt }` |
| `sync:set-lock` | Manually set/clear the Postgres dataset lock |

### Sync page (renderer)

A new **Sync** page in the renderer exposes these operations:

- **Batch list** — shows each import batch with its push status and a push button
- **Push all unpushed** — bulk push button
- **Sync back** — triggers sync-back with the stored `last_sync_at` timestamp
- **Status** — shows last push times and last sync timestamp

### Database changes required for sync

Two migrations are needed in `src/main/db/index.ts`:

```sql
-- Track when each batch was pushed
ALTER TABLE import_batches ADD COLUMN pushed_at TEXT;

-- Track updated_at on sightings for sync comparison
ALTER TABLE sightings ADD COLUMN updated_at TEXT;
ALTER TABLE sightings ADD COLUMN created_at TEXT;
```

`updated_at` in SQLite is managed manually — set to `new Date().toISOString()` on insert and on every `sightings:update` call.

### Column name mapping (Electron → Pi)

The Electron app uses camelCase (from Drizzle). The Pi API expects snake_case. The push code maps between them using the same field list as `commitParsed()`:

| SQLite/Drizzle | Postgres API |
|---|---|
| `lbcId` | `lbc_id` |
| `commonName` | `common_name` |
| `scientificName` | `scientific_name` |
| `locationId` | `location_id` |
| `importBatchId` | `import_batch_id` |
| `date` | `date` |
| ... | ... |

The full mapping is defined in `src/main/sync/index.ts` (to be created).


---

## Pi Integration

This section covers the connection between the Electron app and the Raspberry Pi API server, including the push and sync-back workflows.

### Overview

```text
Electron App (Mac)                    Raspberry Pi
  SQLite (local)      ──push──►       Postgres 17
                      ◄─sync──        Node/Hono API (port 3000)
                                      Tailscale IP: 100.x.x.x
```

The Electron app connects to the Pi API using a shared API key (`ELECTRON_API_KEY`) stored in the Pi's `.env` file. This is separate from the JWT tokens used by web app users and bypasses the JWT auth middleware — used only for bulk operations.

### Environment variables (Electron)

Add these to `.env` at the project root (gitignored):

```
VITE_STADIA_API_KEY=...
LBC_API_URL=http://100.x.x.x:3000   # Pi's Tailscale IP
LBC_API_KEY=...                      # must match ELECTRON_API_KEY on the Pi
```

These are injected into the main process bundle at build time via the `electron.vite.config.ts` `define` block — they are never exposed to the renderer.

### Pi API authentication for Electron

Bulk operations send `Authorization: ApiKey <key>`. The relevant endpoints check this header directly without going through the `requireAuth` JWT middleware.

### Sync module

All push and sync-back logic lives in `src/main/sync/index.ts`. IPC handlers are registered via `registerSyncHandlers()` in `src/main/ipc/index.ts`, called from `src/main/index.ts`.

### Push workflow

The **Push** operation sends SQLite records to Postgres. It is batch-level — only batches with `pushed_at = null` are sent. Existing Postgres data is never overwritten by a push.

**Typical start-of-season sequence:**

1. **Push Locations** — upserts all locations from SQLite to Postgres via `POST /locations/bulk-upsert`. Includes GeoJSON geometry, centroid lat/lon, grid reference.
2. **Push Species** — upserts all species from SQLite to Postgres via `POST /species/upsert`.
3. **Push All Unpushed Batches** — for each unpushed batch:
   - Locks the dataset (`PUT /settings/dataset_locked = true`)
   - Queries SQLite sightings joined to locations (to include `location_name`)
   - Sends in chunks of 500 to `POST /sightings/bulk-upsert`
   - The Pi resolves `location_name` → `location_id` during insert
   - On success, stamps `pushed_at` on the batch in SQLite
   - Releases the lock

**Mid-season additional batches** follow the same flow — only new unpushed batches are sent, existing Postgres records are untouched.

### Sync-back workflow

The **Sync Back** operation pulls all changes made in the web app since the last sync.

**Steps:**

1. Reads `last_sync_at` from the SQLite `settings` table (defaults to epoch if never synced)
2. Locks the dataset
3. Fetches all Postgres sightings changed since that timestamp via `GET /sightings/changes-since/:timestamp`
4. For each returned record:
   - `is_deleted = true` → hard delete from SQLite by `lbc_id`
   - `lbc_id` present → update the matching SQLite row (Postgres values win)
   - `lbc_id = null` (web-created) → assign a new LBC ID via `reserveLbcSequence(1)`, insert into SQLite, PATCH Postgres with the assigned ID
5. Stamps `last_sync_at` in SQLite settings
6. Releases the lock

Date and time fields are cleaned during sync-back using `cleanDate()` (strips to `YYYY-MM-DD`) and `cleanTime()` (strips to `HH:MM`) to ensure SQLite stores the same format as imported records.

### IPC handlers for sync

Registered via `registerSyncHandlers()`:

| IPC channel | Description |
|---|---|
| `sync:get-status` | Returns batch list with pushed status and last sync timestamp |
| `sync:push-locations` | Push all locations to Postgres |
| `sync:push-species` | Push all species to Postgres |
| `sync:push-batch` | Push a single batch (locks/unlocks around the operation) |
| `sync:push-all-unpushed` | Push all unpushed batches in sequence |
| `sync:sync-back` | Pull all Postgres changes since `last_sync_at` |
| `sync:set-lock` | Manually set or clear the dataset lock |

### Sync page (renderer)

`src/renderer/src/pages/SyncPage.tsx` provides the UI:

- Status summary — batches pushed, batches not yet pushed, last sync-back timestamp
- Reference Data section — Push Locations and Push Species buttons (run once per season)
- Push Sightings section — Push All Unpushed Batches button
- Sync Back section — Sync Back from Web button
- Import Batches table — individual batch push buttons with push timestamps

### Database schema changes for sync

Added in `src/main/db/index.ts` migrations:

```sql
ALTER TABLE import_batches ADD COLUMN pushed_at TEXT;
ALTER TABLE sightings ADD COLUMN created_at TEXT;
ALTER TABLE sightings ADD COLUMN updated_at TEXT;
```

`created_at` and `updated_at` are set on every sighting insert. `updated_at` is updated on every `sightings:update` IPC call.

### Known issues and edge cases

- **Records imported before the sync columns were added** will have null `created_at`/`updated_at`. The Postgres `NOT NULL` constraint on these columns was dropped to accommodate this. Run: `UPDATE sightings SET date = substr(date, 1, 10) WHERE date LIKE '%T%'` to clean up any time suffixes in SQLite.
- **Re-pushing already pushed batches**: `UPDATE import_batches SET pushed_at = NULL WHERE id = ?` then push again.
- **Clearing Postgres sightings**: `TRUNCATE sightings RESTART IDENTITY` on the Pi, then reset all `pushed_at` in SQLite and re-push.
