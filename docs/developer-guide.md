# LBC Bird Report — Developer Guide

## Contents

1. [Architecture overview](#architecture-overview)
2. [Project structure](#project-structure)
3. [Technology stack](#technology-stack)
4. [Development setup](#development-setup)
5. [macOS build notes](#macos-build-notes)
6. [Database schema](#database-schema)
7. [IPC API](#ipc-api)
8. [Adding a new importer format](#adding-a-new-importer-format)
9. [Adding fields to the schema](#adding-fields-to-the-schema)
10. [Building for distribution](#building-for-distribution)

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
│  • Import wizard                            │
│  • Sightings table                          │
│  • MapLibre GL map                          │
│  • Location editor                          │
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
│   │   ├── index.ts        Database initialisation (SQLite + Drizzle)
│   │   └── schema.ts       Drizzle table definitions
│   ├── ipc/
│   │   └── index.ts        All ipcMain.handle() registrations
│   ├── importers/
│   │   ├── index.ts        readSpreadsheet() — CSV/XLSX/ODS reader
│   │   ├── normalise.ts    Row normalisation against a FieldMapping
│   │   ├── parseDate.ts    Multi-format date parser
│   │   └── types.ts        Re-exports from shared/types.ts
│   ├── locations/
│   │   └── match.ts        Name + coordinate location matching
│   └── electron-submodules.d.ts   Type shims for electron/main etc.
│
├── preload/
│   └── index.ts            Exposes window.api via contextBridge
│
├── renderer/
│   ├── index.html          Vite entry HTML
│   └── src/
│       ├── main.tsx        React entry point
│       ├── App.tsx         Navigation shell
│       ├── env.d.ts        window.api type declarations
│       └── pages/
│           ├── ImportPage.tsx
│           ├── SightingsPage.tsx
│           ├── MapPage.tsx
│           ├── LocationsPage.tsx
│           └── ExportPage.tsx
│
└── shared/
    └── types.ts            Types shared between main and renderer

docs/                       This documentation
release/                    electron-builder output (gitignored)
out/                        electron-vite build output (gitignored)
src/db/migrations/          Drizzle-generated SQL migrations
drizzle.config.ts           Drizzle Kit configuration
electron.vite.config.ts     electron-vite build configuration
```

---

## Technology stack

| Layer | Library | Notes |
| --- | --- | --- |
| Desktop shell | [Electron](https://electronjs.org) v32 | |
| Build tool | [electron-vite](https://electron-vite.org) v3 | Vite-based, handles main + preload + renderer |
| Packaging | [electron-builder](https://www.electron.build) v25 | Creates signed .app and DMG |
| UI framework | [React](https://react.dev) v18 | No component library — plain inline styles |
| Database | [SQLite](https://sqlite.org) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | Single file in `~/Library/Application Support` |
| ORM | [Drizzle ORM](https://orm.drizzle.team) | Type-safe queries, schema-as-code |
| Spreadsheet parsing | [xlsx](https://github.com/SheetJS/sheetjs) | Handles CSV, XLSX, XLS and ODS |
| CSV parsing | [csv-parse](https://csv.js.org/parse/) | Used for CSV specifically |
| Mapping | [MapLibre GL JS](https://maplibre.org) v5 | Open source, no API key needed |
| Spatial operations | [Turf.js](https://turfjs.org) v7 | Point-distance for location matching |
| Language | TypeScript 5.7 | Strict mode throughout |

---

## Development setup

### Prerequisites

- macOS 12+ (Apple Silicon or Intel)
- Node.js 18+
- An Apple Developer account (required for code signing — see macOS build notes)

### Install

```bash
git clone https://github.com/YOUR_USERNAME/LBCBirdReportDataJS.git
cd LBCBirdReportDataJS
npm install
```

### Run

```bash
npm run dev
```

This compiles main + preload + renderer, packages a signed `.app` via `electron-builder --dir`, copies it into `/Applications`, and re-signs it. When the build finishes you'll see:

```text
Build complete — open LBC Bird Report from Spotlight or Applications
```

Open the app from Spotlight (`⌘ Space`, type `LBC Bird Report`) or from the Applications folder in Finder.

**Hot-reload is not available** — see macOS build notes below.

### Typecheck

```bash
npm run typecheck
```

---

## macOS build notes

### Why `npm run dev` builds a full app instead of using electron-vite's dev server

On macOS 15 (Sequoia) with Apple Silicon, the ad-hoc-signed Electron binary that ships in the `electron` npm package cannot register its internal module system when launched directly from the terminal. As a result, `require('electron')` does not return the Electron API, and the app crashes silently.

This is a macOS 15 security model restriction. The workaround is to package the app with electron-builder, which signs it with the developer's Apple Development certificate. The signed `.app` bundle, when launched through macOS LaunchServices, initialises correctly.

**Practical consequence:** Each code change requires a rebuild cycle (~15–20 seconds). Edit your code, run `npm run dev`, then open the app from Spotlight or Applications.

### Code signing

electron-builder automatically uses the first available Apple Development certificate in your Keychain. If you have multiple certificates, set `CSC_NAME` in your environment:

```bash
CSC_NAME="Apple Development: Your Name (TEAMID)" npm run dist
```

For distribution outside the App Store you need a **Developer ID Application** certificate and notarisation — see the [electron-builder docs](https://www.electron.build/code-signing).

---

## Database schema

Defined in [src/main/db/schema.ts](../src/main/db/schema.ts) using Drizzle ORM.

### `locations`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | Auto-increment |
| `name` | TEXT | Required |
| `grid_ref` | TEXT | OS or Irish grid reference |
| `lat` | REAL | WGS84 decimal degrees |
| `lon` | REAL | WGS84 decimal degrees |
| `country` | TEXT | |
| `region` | TEXT | |
| `notes` | TEXT | |

### `import_batches`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `filename` | TEXT | Original filename |
| `format` | TEXT | `csv` / `xlsx` / `ods` |
| `imported_at` | TEXT | ISO 8601 timestamp |
| `row_count` | INTEGER | |
| `field_mapping` | TEXT | JSON — source→standard column map |

### `sightings`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `import_batch_id` | INTEGER FK | → `import_batches.id` |
| `location_id` | INTEGER FK | → `locations.id` (nullable) |
| `species` | TEXT | Required |
| `common_name` | TEXT | |
| `scientific_name` | TEXT | |
| `order` | TEXT | Taxonomic order |
| `family` | TEXT | |
| `date` | TEXT | ISO 8601 `YYYY-MM-DD` |
| `time` | TEXT | `HH:MM` |
| `count` | INTEGER | |
| `count_approx` | INTEGER | Upper bound when count is a range |
| `sex` | TEXT | M / F / U |
| `age` | TEXT | ad / imm / juv / U |
| `breeding` | TEXT | BTO breeding code |
| `ring` | TEXT | Ring number |
| `observer` | TEXT | |
| `source_ref` | TEXT | Original row reference for audit |
| `lat` | REAL | May differ from location centroid |
| `lon` | REAL | |
| `notes` | TEXT | |
| `raw_data` | TEXT | Original import row as JSON |

---

## IPC API

All communication between renderer and main process goes through `window.api`, defined in [src/preload/index.ts](../src/preload/index.ts) and typed in [src/renderer/src/env.d.ts](../src/renderer/src/env.d.ts).

### `window.api.import.openFile()`

Opens a system file picker filtered to `.csv`, `.xlsx`, `.xls`, `.ods`.

Returns `{ path, sheets, headers, preview }` or `null` if cancelled. `sheets` is an empty array for CSV files.

### `window.api.import.readSheet(filePath, sheetName, skipRows)`

Reads headers and a 5-row preview from the given sheet, skipping the specified number of rows before the header. Used when the user changes worksheet or adjusts the skip-rows setting.

### `window.api.import.commit(filePath, mapping, sheetName?, skipRows?)`

Parses and imports the file using the provided `FieldMapping`. Returns `{ imported: number, warnings: string[] }`.

### `window.api.sightings.list()`

Returns all rows from the `sightings` table as `Sighting[]`.

### `window.api.locations.list()`

Returns all rows from the `locations` table as `Location[]`.

### `window.api.locations.upsert(data)`

Inserts or updates a location. If `data.id` is set, updates the existing row.

### `window.api.export.sql()`

Opens a save dialog, writes a Postgres-compatible `.sql` file, and returns the path or `null` if cancelled.

---

## Adding a new importer format

All format-specific reading is in [src/main/importers/index.ts](../src/main/importers/index.ts). The `readSpreadsheet()` function dispatches on file extension:

```typescript
export function readSpreadsheet(filePath: string, sheetName?: string, skipRows = 0) {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.csv') return readCsv(filePath, skipRows)
  if (ext === '.xlsx' || ext === '.xls') return readXlsx(filePath, sheetName, skipRows)
  if (ext === '.ods') return readOds(filePath, sheetName, skipRows)
  throw new Error(`Unsupported file format: ${ext}`)
}
```

To add a new format:

1. Add a `readXxx(filePath, skipRows)` function in the same file that returns `{ headers: string[]; rows: RawRow[] }`.
2. Add the extension to the dispatch block above.
3. Add the extension to the `filters` array in the `import:open-file` IPC handler in [src/main/ipc/index.ts](../src/main/ipc/index.ts).

---

## Adding fields to the schema

1. Add the column to `sightings` in [src/main/db/schema.ts](../src/main/db/schema.ts).
2. Run `npm run db:generate` to create a migration SQL file.
3. Add the field to `ParsedSighting` and `Sighting` in [src/shared/types.ts](../src/shared/types.ts).
4. Update `normaliseRows()` in [src/main/importers/normalise.ts](../src/main/importers/normalise.ts) to map the new field.
5. Update the `import:commit` IPC handler in [src/main/ipc/index.ts](../src/main/ipc/index.ts) to write the new field.
6. Update `STANDARD_FIELDS` in [src/renderer/src/pages/ImportPage.tsx](../src/renderer/src/pages/ImportPage.tsx) to expose the field in the mapping UI.
7. Update the Postgres export helpers at the bottom of [src/main/ipc/index.ts](../src/main/ipc/index.ts).

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
