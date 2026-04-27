# LBC Bird Report — User Guide

## Contents

1. [Getting started](#getting-started)
2. [Importing data](#importing-data)
3. [Fixing validation errors](#fixing-validation-errors)
4. [Reviewing and editing before saving](#reviewing-and-editing-before-saving)
5. [The sightings table](#the-sightings-table)
6. [Import history](#import-history)
7. [Managing locations](#managing-locations)
8. [Managing species](#managing-species)
9. [Exporting data](#exporting-data)
10. [Tips and troubleshooting](#tips-and-troubleshooting)

---

## Getting started

Open **LBC Bird Report** from your Applications folder. The app opens with sections in the left-hand sidebar:

| Section | Purpose |
| --- | --- |
| **Import** | Load a spreadsheet and map its columns to standard fields |
| **History** | Browse all past imports and manage source files |
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
| Original location | No | Raw location string — used for regex and spatial matching |
| Location name | No | Matched directly against your Locations list by name |
| Latitude / Longitude | No | Decimal degrees WGS84 — enables spatial matching. Also recognised as **Trip Latitude / Trip Longitude** |
| Start Time / End Time | No | Recognised as **First Time / Last Time** too |
| Observer | No | Free text |
| Notes | No | Free text |
| Dataset | No | Can be set per-batch in Step 2 instead |
| LBC ID | No | If the source already has LBC identifiers |

### Step 4 — Preview and validate

Click **Validate**. The app parses every row, matches species against your species list, and attempts to match each location. If all rows pass validation you are taken straight to the **Review** page. If any rows fail, you are taken to the **Edit Data** screen instead.

### Source file storage

When you save an import to the database, the source spreadsheet is automatically moved to:

```text
~/Library/Application Support/lbc-bird-report/imports/
```

The file is renamed with a timestamp prefix (e.g. `2026-04-25T13-23-35_LBC-2025-03.ods`). You can open or locate it later from the History page or Sightings page.

### Supported date formats

| Format | Example |
| --- | --- |
| ISO 8601 | `2024-04-15` |
| DD/MM/YYYY | `15/04/2024` |
| DD-MM-YYYY | `15-04-2024` |
| DD.MM.YYYY | `15.04.2024` |
| Excel serial date | `45397` |

### Time fields

Columns mapped to **Start Time** or **End Time** that contain time-only values in Excel (e.g. `09:30`) are imported as `HH:MM`. Column names automatically recognised include:

- Start Time, First Time
- End Time, Last Time

---

## Fixing validation errors

If any rows fail validation, the **Edit Data** screen opens automatically instead of the Review page. This is a full spreadsheet editor showing every row and column from your import.

### Reading the Status column

The first column shows each row's status:

- **Green ✓** — row is valid
- **Red message** — the validation error for that row (e.g. missing date, unrecognised value)

Click any column header to sort rows by that column — useful for grouping all errors together.

### Editing cells

Click any cell to edit it directly. Fix the values that caused the error and click **Re-import** to re-validate all rows.

### Adding a column

If a field was missing or entirely blank in your source file, you can add it as a new column using the **Add column…** dropdown in the toolbar. Select the field you want and click **+ Add**. The new column is empty and editable — fill in the values you need, then click **Re-import**.

### Opening the source file

Click **Open source file** in the toolbar to open the original spreadsheet in its default application (e.g. LibreOffice or Excel) so you can check values without leaving the app.

### Re-importing

Click **Re-import** to re-validate all rows with your edits. If errors remain, the status column updates to show the new failures. Once all rows show ✓ you are taken to the Review page.

---

## Reviewing and editing before saving

The **Review** page shows every row parsed from your file.

### Match statistics

The toolbar shows a quality breakdown for both species and location matching:

**Species:** `Exact name: 36`  `Regex name: 20`  `No match: 1`  
**Location:** `Confirmed: 25`  `Cached: 18`  `Name match: 10`  `No match: 5`

Click any pill to filter the table to rows with that match quality. Click it again to clear the filter. When a filter is active a **"Showing X of Y rows — Clear filters"** indicator appears.

### Column header filters

The **Species match** and **Location match** column headers each have a dropdown that filters the table to a specific quality. Both filters can be active at the same time.

### Species column

The **Common name** column is a dropdown. If the app has not matched a species, select the correct one from the list. The scientific name and family update automatically.

### Location column

The **Location override** column is always visible, even when the import contained no location data, so you can assign locations manually. The dropdown shows suggested candidate sites (based on spatial and name matching) followed by all locations. Select the correct site and click **Remember** to cache the match.

When you click **Remember**:

- The button changes to **✓ Remembered** for the rest of the session.
- Every other row in the current import with the same original location string is automatically updated to the same match — you don't need to set them one by one.
- Future imports with the same location string will resolve instantly.

Match quality is colour-coded:

| Colour | Meaning |
| --- | --- |
| Green | Confirmed from cache, or exact name match |
| Amber | Spatial only, name match only, or cached |
| Red | No match or conflict |
| Blue | Manually selected in this session |

### Remembered matches panel

A collapsible **Remembered location matches (N)** panel sits below the toolbar. Expand it to see every cached location match — the original string, the matched site, and when it was confirmed. Individual entries can be removed with the **Remove** button.

### Other editable fields

You can edit count, notes, age, status, subspecies, observer and more directly in the table. Notes fields are multi-line.

### Saving

Click **Save to database**. If any rows still have unmatched species, the app warns you and asks for confirmation — unmatched rows are saved with Common name set to `Unknown`.

You can leave the Review page and visit other sections (e.g. to add a missing species) without losing your edits. Click **Review** in the sidebar to return.

---

## The sightings table

The **Sightings** page lists every imported record.

### Columns

The table shows all fields that have at least one non-empty value, including a **Resolved Location** column that shows the matched site name for each record.

### Editing and deleting records

Each row has **Edit** and **Delete** buttons in the first column.

- **Edit** opens a panel above the table with fields for all editable data — species, dates, count, observer, notes, times, location, and more. Click **Save** to write the changes back to the database.
- **Delete** shows an inline confirmation before removing the record.

### Filtering

Use the **Filter…** box at the top to search across all visible columns simultaneously.

Each column header also has its own **Filter…** input. Column filters are ANDed together — for example, filtering Observer to `MT` and Resolved Location to `Kirkby` shows only records matching both. When column filters are active a **Clear column filters** button appears in the toolbar.

### Source file column

The second column shows which import batch each record came from. Click the filename to filter the table to all records from that file. A blue banner appears showing the record count and buttons to **Open** or **Reveal in Finder** the source file, and **Show all** to clear the filter.

---

## Import history

The **History** page lists every import batch in reverse chronological order.

| Column | Description |
| --- | --- |
| Date | When the import was committed |
| Filename | Original filename |
| Format | File type (CSV, XLSX, ODS…) |
| Records | Number of rows imported |
| Source file | Buttons to open or locate the stored source file |

### Source file actions

- **Open** — open the file in its default application
- **Reveal in Finder** — show the file in a Finder window
- **Locate file…** — appears when the stored path is not found; opens a file picker so you can manually point to the file (e.g. if you have moved it)

### Deleting a batch

Click **Delete** next to a batch and confirm. This removes the batch record and all associated sighting records from the database. The source file is not deleted.

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
- **Remembered matches** — click **View remembered matches** to see all location strings that have been cached to this site, with the date each was confirmed and a **Remove** button to delete individual entries

#### Editing a polygon

Click **Edit polygon** to enter vertex-editing mode. Drag any vertex to reshape the boundary. When editing, neighbouring polygons are visible so you can align shared boundaries precisely. Click **Done** to accept the changes or **Cancel** to discard them. Save the location to write the updated polygon to the database.

### How location matching works at import

For each sighting row the app tries the following in order:

1. **Exact name match** — if the `locationName` field is mapped and its value matches a location name exactly, it resolves immediately.
2. **Match cache** — if the `originalLocation` string has been confirmed before, it resolves instantly.
3. **Point-in-polygon** — if the row has coordinates, the app checks which site polygon contains the point.
4. **Centroid proximity** — if no polygon contains the point, it looks for sites within 2 km.
5. **Regex name matching** — the location string is tested against all regex patterns.

If spatial and name matching agree, the quality is high. If they disagree (conflict), or only one signal matched, the quality is lower and the row is flagged for review.

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

### A location string with leading spaces doesn't match

The app strips leading and trailing whitespace (including tabs) from location strings before matching, so this should be handled automatically. If a match is still missing, check the regex patterns for that site.

### A polygon looks wrong on the map

Click **Edit polygon** to enter vertex-editing mode and drag the vertices to correct the boundary. Save the location when done. Check neighbouring polygons (shown in grey) to make sure the shared boundary aligns.

### I imported the same file twice

Each import creates a new batch and duplicates all rows. Go to the **History** page and delete the unwanted batch — this removes all its sighting records. The original source file is not deleted.

### Where is my database?

```text
~/Library/Application Support/lbc-bird-report/birdreport.db
```

Copy this file to back up all your data.

### Where are my source files stored?

```text
~/Library/Application Support/lbc-bird-report/imports/
```

Files are moved here automatically on import and renamed with a timestamp prefix.
