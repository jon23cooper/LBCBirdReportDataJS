import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'

export const locations = sqliteTable('locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  gridRef: text('grid_ref'),
  lat: real('lat'),
  lon: real('lon'),
  country: text('country'),
  region: text('region'),
  notes: text('notes')
})

export const sightings = sqliteTable('sightings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  importBatchId: integer('import_batch_id').references(() => importBatches.id),
  locationId: integer('location_id').references(() => locations.id),

  // Taxonomic fields
  species: text('species').notNull(),
  commonName: text('common_name'),
  scientificName: text('scientific_name'),
  order: text('order'),
  family: text('family'),

  // Observation fields
  date: text('date').notNull(),           // ISO 8601 YYYY-MM-DD
  time: text('time'),                      // HH:MM
  count: integer('count'),
  countApprox: integer('count_approx'),   // upper bound when count is a range
  sex: text('sex'),                        // M / F / U
  age: text('age'),                        // ad / imm / juv / U
  breeding: text('breeding'),              // BTO breeding code
  ring: text('ring'),
  notes: text('notes'),

  // Observer
  observer: text('observer'),
  sourceRef: text('source_ref'),          // original row ref for traceability

  // Coordinates (may differ from location centroid)
  lat: real('lat'),
  lon: real('lon'),

  // Raw import data preserved for audit
  rawData: text('raw_data')               // JSON string of original row
})

export const importBatches = sqliteTable('import_batches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  format: text('format').notNull(),       // csv | xlsx | ods
  importedAt: text('imported_at').notNull(),
  rowCount: integer('row_count'),
  fieldMapping: text('field_mapping')     // JSON — maps source columns → standard fields
})
