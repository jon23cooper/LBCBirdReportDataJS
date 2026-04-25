# LBC Bird Report

A desktop application for importing, standardising, reviewing and exporting bird observation data.

Built with Electron, TypeScript, React, SQLite and Leaflet.

---

## Features

- **Import** bird sighting data from CSV, Excel (`.xlsx`/`.xls`) and ODS spreadsheets in any column layout
- **Column mapping** — match source columns to standard fields at import time; set dataset and default observer per batch
- **Multi-sheet support** — choose which worksheet to read and skip leading header rows
- **Staging review** — inspect and edit every row before committing to the database: correct species via dropdown, edit location, count, notes and more
- **Species matching** — exact and regex matching against a curated species list; unmatched rows flagged for review
- **Location matching** — spatial (point-in-polygon + centroid proximity) and regex name matching against a polygon database; user-confirmed matches cached for future imports
- **Location manager** — import location polygons from GeoJSON, import name-regex patterns from CSV, edit polygon vertices on an interactive map, manage regex patterns per site
- **Species manager** — maintain a species list with scientific names and regex patterns; import from CSV
- **Sightings table** — view all imported records
- **SQL export** — export the full dataset as a `.sql` file containing `INSERT` statements

---

## Quick start

### Prerequisites

- macOS 12+ (Apple Silicon or Intel)
- Node.js 18+
- An Apple Developer certificate in your Keychain (required for code signing — see developer guide)

### Install dependencies

```bash
npm install
```

### Run / build

```bash
npm run dev
```

This compiles the app, packages it as a signed `.app` bundle, copies it into `/Applications`, re-signs it, and prints:

```text
Build complete — open LBC Bird Report from Spotlight or Applications
```

Open from Spotlight (`⌘ Space → LBC Bird Report`) or the Applications folder.

### Typecheck

```bash
npm run typecheck
```

---

## Data storage

Your data is stored in a local SQLite database:

```text
~/Library/Application Support/lbc-bird-report/birdreport.db
```

Back it up by copying this file anywhere.

---

## Tile provider

The location map uses [OpenStreetMap.DE](https://openstreetmap.de) tiles. If you prefer [Stadia Maps](https://stadiamaps.com) (free account required), add your API key to a `.env` file at the project root:

```text
VITE_STADIA_API_KEY=your_key_here
```

Then update the tile URL in `src/renderer/src/pages/LocationsPage.tsx` to use the Stadia endpoint. The `.env` file is gitignored.

---

## Licence

MIT
