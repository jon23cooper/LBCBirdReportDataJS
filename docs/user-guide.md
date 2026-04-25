# LBC Bird Report — User Guide

## Contents

1. [Getting started](#getting-started)
2. [Importing data](#importing-data)
3. [Reviewing and editing before saving](#reviewing-and-editing-before-saving)
4. [The sightings table](#the-sightings-table)
5. [Managing locations](#managing-locations)
6. [Managing species](#managing-species)
7. [Exporting data](#exporting-data)
8. [Tips and troubleshooting](#tips-and-troubleshooting)

---

## Getting started

Open **LBC Bird Report** from your Applications folder. The app opens with sections in the left-hand sidebar:

| Section | Purpose |
| --- | --- |
| **Import** | Load a spreadsheet and map its columns to standard fields |
| **Review** | Inspect and edit every row before saving to the database |
| **Sightings** | Browse all imported records |
| **Locations** | Import and edit recording site polygons and regex patterns |
| **Species** | Maintain the species reference list |
| **Export** | Save a SQL file of all your data |

Your data is stored locally at:

```text
~/Library/Application Support/lbc-bird-report/birdreport.db
```

Back it up by copying that file anywhere.

---

## Importing data

The app can read **CSV**, **Excel** (`.xlsx` / `.xls`) and **ODS** spreadsheets in any column layout.

### Step 1 — Choose a file

Click **Choose file…** on the Import page and select your spreadsheet. For Excel and ODS files, choose which worksheet to read and how many rows to skip before the header row.

### Step 2 — Set batch options

Optionally set a **Dataset** label (e.g. `LBC 2024`) and a **Default observer** name that will be applied to rows where the observer column is blank.

### Step 3 — Map the columns

Use the dropdowns to match your source columns to standard fields:

| Standard field | Required? | Notes |
| --- | --- | --- |
| **Species** | Yes | Any species name string |
| **Date** | Yes | See date formats below |
| Common name | No | If separate from species |
| Scientific name | No | |
| Count | No | Integer |
| Original count | No | Raw count string preserved for audit |
| Location name | No | Matched against your Locations list |
| Latitude / Longitude | No | Decimal degrees WGS84 — enables spatial matching |
| Observer | No | Free text |
| Notes | No | Free text |
| Dataset | No | Can be set per-batch in Step 2 instead |
| LBC ID | No | If the source already has LBC identifiers |

### Step 4 — Preview and validate

Click **Validate**. The app parses every row, matches species against your species list, and attempts to match each location. You are taken to the **Review** page.

### Supported date formats

| Format | Example |
| --- | --- |
| ISO 8601 | `2024-04-15` |
| DD/MM/YYYY | `15/04/2024` |
| DD-MM-YYYY | `15-04-2024` |
| DD.MM.YYYY | `15.04.2024` |
| Excel serial date | `45397` |

---

## Reviewing and editing before saving

The **Review** page shows every row parsed from your file, sorted by match quality — unmatched rows appear first so problems are visible immediately.

### Species column

The **Common name** column is a dropdown. If the app has not matched a species, select the correct one from the list. The scientific name and family update automatically. Rows with no species match are highlighted in red.

### Location column

The **Location** dropdown shows suggested candidate sites (based on spatial and name matching) followed by all locations. Select the correct site and click **Remember** to cache the match — future imports with the same location string will resolve instantly.

Match quality is colour-coded:

| Colour | Meaning |
| --- | --- |
| Green | Confirmed from cache, or spatial + name agree |
| Amber | Spatial only, or name only |
| Red | No match |
| Blue | Manually selected in this session |

### Other editable fields

You can edit count, notes, age, status, subspecies, observer and more directly in the table. Notes fields are multi-line.

### Saving

Click **Save to database**. If any rows still have unmatched species, the app warns you and asks for confirmation — unmatched rows are saved with Common name set to `Unknown`.

You can leave the Review page and visit other sections (e.g. to add a missing species) without losing your edits. Click **Review** in the sidebar to return.

---

## The sightings table

The **Sightings** page lists every imported record.

---

## Managing locations

The **Locations** page manages the list of named recording sites used for location matching.

### Importing polygons

Click **Import polygons (GeoJSON)…** and select a GeoJSON file. The file must contain Polygon features with a `Name` property matching your site names. Centroids are computed automatically.

### Importing regex patterns

Click **Import location regex (CSV)…** and select a CSV file with three columns:

| Column | Description |
| --- | --- |
| `siteName` | Must match a location `Name` exactly |
| `regex` | JavaScript-compatible regex pattern |
| `matchName` | The place name this pattern refers to |

This replaces all existing regex patterns. Each site can have multiple patterns.

### Editing a location

Click **Edit** next to any location. The edit panel shows:

- **Fields** — name, grid ref, country, region, notes, lat/lon
- **Map** — the site's polygon with all neighbouring polygons shown as grey outlines; hover a neighbour to see its name
- **Regex patterns** — click **Edit regex patterns** to add, edit or delete name patterns for this site

#### Editing a polygon

Click **Edit polygon** to enter vertex-editing mode. Drag any vertex to reshape the boundary. When editing, neighbouring polygons are visible so you can align shared boundaries precisely. Click **Done** to accept the changes or **Cancel** to discard them. Save the location to write the updated polygon to the database.

### How location matching works at import

For each sighting row the app tries the following in order:

1. **Match cache** — if this exact location string has been confirmed before, it resolves instantly.
2. **Point-in-polygon** — if the row has coordinates, the app checks which site polygon contains the point.
3. **Centroid proximity** — if no polygon contains the point, it looks for sites within 2 km.
4. **Regex name matching** — the location string is tested against all regex patterns.

If spatial and name matching agree, the quality is high. If they disagree (conflict), or only one signal matched, the quality is lower and the row is flagged for review in the staging table.

---

## Managing species

The **Species** page maintains the reference list used for species matching at import.

### Importing a species list

Click **Import species CSV…** and select a CSV file with columns:

| Column | Required? | Notes |
| --- | --- | --- |
| `commonName` | Yes | |
| `scientificName` | Yes | |
| `family` | No | |
| `commonNameRegex` | No | Regex for matching name variants |
| `scientificNameRegex` | No | Regex for matching scientific name variants |

### Adding or editing a species

Click **Edit** next to any species, or **Add species** to create a new entry. Fill in the fields and click **Save**.

### How species matching works at import

For each row the app tries, in order:

1. Exact match on scientific name
2. Exact match on common name
3. Regex match on scientific name
4. Regex match on common name

Rows with no match are flagged in the staging review and can be corrected via the dropdown before saving.

---

## Exporting data

The **Export** page saves your entire dataset as a SQL file.

Click **Save SQL file…**, choose a location, and the app writes `INSERT` statements for all sightings and locations. You can load this into any PostgreSQL database:

```bash
psql -d your_database -f birdreport.sql
```

---

## Tips and troubleshooting

### My dates aren't being recognised

Check that the date column is stored as text, not as a date-formatted number. Excel date serials (large integers like `45397`) are handled automatically if the whole column contains only serials.

### Sightings don't match the right location

Check your regex patterns on the Locations page — a pattern that is too broad can match the wrong site. Use anchors (`^`, `$`) and specific terms to narrow patterns down.

### A polygon looks wrong on the map

Click **Edit polygon** to enter vertex-editing mode and drag the vertices to correct the boundary. Save the location when done. Check neighbouring polygons (shown in grey) to make sure the shared boundary aligns.

### I imported the same file twice

Each import creates a new batch and duplicates all rows. Delete the database file and re-import from scratch to start clean:

```text
~/Library/Application Support/lbc-bird-report/birdreport.db
```

### Where is my database?

```text
~/Library/Application Support/lbc-bird-report/birdreport.db
```

Copy this file to back up all your data.
