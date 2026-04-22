# LBC Bird Report

A desktop application for importing, standardising, mapping and exporting bird observation data.

Built with Electron, TypeScript, React, SQLite and MapLibre GL.

---

## Features

- **Import** bird sighting data from CSV, Excel (`.xlsx`/`.xls`) and ODS spreadsheets in any column layout
- **Column mapping UI** — match your source columns to standard fields at import time
- **Date normalisation** — handles ISO, DD/MM/YYYY, MM/DD/YYYY and Excel serial date formats automatically
- **Location matching** — assign sightings to known locations by name lookup or coordinate proximity (within 500 m)
- **Sightings table** — searchable, filterable view of all imported records
- **Map view** — clustered pin map of all geolocated sightings (MapLibre GL, no API key required)
- **Location manager** — add and edit named locations with grid references and coordinates
- **Postgres export** — export the full dataset as a `.sql` file containing `CREATE TABLE` and `INSERT` statements compatible with PostgreSQL

---

## Data model

| Field | Description |
|---|---|
| `species` | Common species name as imported |
| `scientific_name` | Scientific name (optional) |
| `date` | ISO 8601 (`YYYY-MM-DD`) |
| `time` | `HH:MM` (optional) |
| `count` | Integer count |
| `sex` | M / F / U |
| `age` | ad / imm / juv / U |
| `breeding` | BTO breeding code |
| `observer` | Observer name |
| `location_id` | FK to `locations` table |
| `lat` / `lon` | Decimal degrees (WGS84) |
| `raw_data` | Original import row preserved as JSON |

---

## Quick start

### Prerequisites

- macOS 12+ (Apple Silicon or Intel)
- Node.js 18+

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run dev
```

This builds the app, packages it as a signed `.app` bundle and opens it.

### Build a distributable DMG

```bash
npm run dist
```

The DMG is written to `release/`.

---

## Licence

MIT
