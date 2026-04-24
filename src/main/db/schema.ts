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

  // Reference / provenance
  occurrenceKey: text('occurrence_key'),
  dataset: text('dataset'),
  lbcId: text('lbc_id'),

  // Taxonomic
  species: text('species').notNull(),
  originalCommonName: text('original_common_name'),
  commonName: text('common_name'),
  originalScientificName: text('original_scientific_name'),
  scientificName: text('scientific_name'),
  family: text('family'),
  subspeciesCommon: text('subspecies_common'),
  subspeciesScientific: text('subspecies_scientific'),

  originalLocation: text('original_location'),

  // Dates and times
  date: text('date').notNull(),            // ISO 8601 YYYY-MM-DD (first/only date)
  lastDate: text('last_date'),             // ISO 8601 YYYY-MM-DD
  time: text('time'),                       // HH:MM start time
  endTime: text('end_time'),               // HH:MM end time

  // Count
  count: integer('count'),
  originalCount: text('original_count'),   // raw count string (may be a range)
  circa: text('circa'),                    // approximate flag

  // Observation detail
  age: text('age'),
  status: text('status'),
  breedingCode: text('breeding_code'),
  breedingCategory: text('breeding_category'),
  behaviorCode: text('behavior_code'),

  // Observer
  observer: text('observer'),
  notes: text('notes'),

  // Spatial
  lat: real('lat'),
  lon: real('lon'),
  uncertaintyRadius: real('uncertainty_radius'),
  geometryType: text('geometry_type'),
  tripMapRef: text('trip_map_ref'),

  // Audit
  sourceRef: text('source_ref'),
  rawData: text('raw_data')
})

export const importBatches = sqliteTable('import_batches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  format: text('format').notNull(),
  importedAt: text('imported_at').notNull(),
  rowCount: integer('row_count'),
  fieldMapping: text('field_mapping')
})
