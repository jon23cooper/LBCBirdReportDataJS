# LBC Bird Report — User Guide

## Contents

1. [Getting started](#getting-started)
2. [Importing data](#importing-data)
3. [The sightings table](#the-sightings-table)
4. [The map](#the-map)
5. [Managing locations](#managing-locations)
6. [Exporting data](#exporting-data)
7. [Tips and troubleshooting](#tips-and-troubleshooting)

---

## Getting started

Open **LBC Bird Report** from your Applications folder. The app opens with five sections in the left-hand sidebar:

| Section | Purpose |
|---|---|
| **Import** | Load a spreadsheet and bring its records into the database |
| **Sightings** | Browse and search all imported records |
| **Map** | View geolocated sightings on a map |
| **Locations** | Add and edit named recording locations |
| **Export** | Save a Postgres-compatible SQL file |

Your data is stored in a local SQLite database at:

```
~/Library/Application Support/lbc-bird-report/birdreport.db
```

This file is yours — back it up by copying it anywhere.

---

## Importing data

The app can read **CSV**, **Excel** (`.xlsx` / `.xls`) and **ODS** spreadsheets. Your file can use any column names — you tell the app which column means what.

### Step 1 — Choose a file

Click **Choose file…** on the Import page and select your spreadsheet. The app reads the first sheet (for Excel/ODS) or the whole file (for CSV).

### Step 2 — Map the columns

A table appears showing every column in your file on the right, and the standard field names on the left. Use the dropdowns to match them up.

| Standard field | Required? | Notes |
|---|---|---|
| **Species** | Yes | Any species name string |
| **Date** | Yes | See date formats below |
| Count | No | Integer; ranges not currently supported |
| Location name | No | Matched against your Locations list |
| Latitude | No | Decimal degrees, WGS84 |
| Longitude | No | Decimal degrees, WGS84 |
| Observer | No | Free text |
| Notes | No | Free text |

You only need to map **Species** and **Date** to import. The more columns you map, the richer the data.

### Step 3 — Preview

Below the mapping table you can see the first five rows of your file as a sanity check before importing.

### Step 4 — Import

Click **Import**. A green confirmation shows how many records were added. Any rows that could not be parsed (e.g. unreadable dates) are listed as warnings — check these to see if data was missed.

### Supported date formats

The app automatically recognises:

| Format | Example |
|---|---|
| ISO 8601 | `2024-04-15` |
| DD/MM/YYYY | `15/04/2024` |
| DD-MM-YYYY | `15-04-2024` |
| DD.MM.YYYY | `15.04.2024` |
| Excel serial date | `45397` |

If your dates are in MM/DD/YYYY (US) format the app will try to detect this automatically, but you may need to check that ambiguous dates (e.g. `04/05/2024`) are read correctly.

---

## The sightings table

The **Sightings** page lists every imported record. Use the filter box at the top to search by any visible column — species name, observer, date, etc.

The total record count updates as you type.

---

## The map

The **Map** page shows all sightings that have latitude/longitude coordinates. Points are clustered at lower zoom levels — click a cluster to zoom in, or click an individual point to see the species, date and count.

Pan with click-and-drag; zoom with scroll or the +/− buttons.

---

## Managing locations

The **Locations** page is your list of named recording sites. Locations are used to group sightings even when coordinate data is absent or approximate.

### Adding a location

Click **Add location** and fill in:

| Field | Notes |
|---|---|
| Name | Required — this is what the importer matches against |
| Grid ref | OS or Irish grid reference (stored as text) |
| Lat / Lon | Decimal degrees — enables map display and proximity matching |
| Country / Region | Free text |
| Notes | Any additional notes |

Click **Save**.

### How location matching works at import

When you import sightings, the app tries to assign a location to each row:

1. **Coordinates first** — if the row has lat/lon, it looks for the nearest location within 500 m.
2. **Name fallback** — if no nearby location is found, it does a partial name match against the Location name column.
3. **Unmatched** — if neither succeeds, the sighting is imported without a location link (you can assign it later via a future editing feature).

---

## Exporting data

The **Export** page saves your entire dataset as a Postgres-compatible `.sql` file.

Click **Save SQL file…**, choose where to save, and the app writes a file containing:

- `CREATE TABLE IF NOT EXISTS` statements for `locations` and `sightings`
- `INSERT` statements for every row

You can load this into any PostgreSQL database with:

```bash
psql -d your_database -f birdreport.sql
```

---

## Tips and troubleshooting

**My dates aren't being recognised**

Check that the date column in your spreadsheet is stored as text, not as a date-formatted number. If it's an Excel date serial (a large integer like `45397`), the app handles this automatically — but only if the column contains nothing but date serials.

**Sightings aren't appearing on the map**

Only records with both a latitude and longitude will appear. Make sure you mapped the Lat and Lon columns at import, and that the values are decimal degrees (e.g. `51.5074`, not `51°30'26"N`).

**I imported the same file twice**

Each import creates a new batch. The sightings table will show duplicates. A future version will add duplicate detection; for now, the safest fix is to delete the database file and re-import from scratch.

**Where is my database?**

```
~/Library/Application Support/lbc-bird-report/birdreport.db
```

Copy this file to back up all your data.
