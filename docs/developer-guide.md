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
| `openCsvFile()` | File picker → path or `null` |
| `importCsv(filePath)` | Import species list from CSV → `{ imported, errors }` |

### `window.api.export`

| Method | Description |
| --- | --- |
| `sql()` | Save dialog → write SQL file → path or `null` |

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
