import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'

export const locations = sqliteTable('locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  gridRef: text('grid_ref'),
  lat: real('lat'),          // kept for manual entries
  lon: real('lon'),          // kept for manual entries
  centroidLat: real('centroid_lat'),  // computed from polygon
  centroidLon: real('centroid_lon'),
  geometry: text('geometry'),          // GeoJSON Polygon geometry as JSON string
  country: text('country'),
  region: text('region'),
  notes: text('notes')
})

export const sightings = sqliteTable('sightings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  importBatchId: integer('import_batch_id').references(() => importBatches.id),
  locationId: integer('location_id').references(() => locations.id),
  occurrenceKey: text('occurrence_key'),
  dataset: text('dataset'),
  lbcId: text('lbc_id'),
  species: text('species').notNull(),
  originalCommonName: text('original_common_name'),
  commonName: text('common_name'),
  originalScientificName: text('original_scientific_name'),
  scientificName: text('scientific_name'),
  family: text('family'),
  subspeciesCommon: text('subspecies_common'),
  subspeciesScientific: text('subspecies_scientific'),
  originalLocation: text('original_location'),
  date: text('date').notNull(),
  lastDate: text('last_date'),
  time: text('time'),
  endTime: text('end_time'),
  count: integer('count'),
  originalCount: text('original_count'),
  circa: text('circa'),
  age: text('age'),
  status: text('status'),
  breedingCode: text('breeding_code'),
  breedingCategory: text('breeding_category'),
  behaviorCode: text('behavior_code'),
  observer: text('observer'),
  notes: text('notes'),
  lat: real('lat'),
  lon: real('lon'),
  uncertaintyRadius: real('uncertainty_radius'),
  geometryType: text('geometry_type'),
  tripMapRef: text('trip_map_ref'),
  sourceRef: text('source_ref'),
  rawData: text('raw_data')
})

export const importBatches = sqliteTable('import_batches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  format: text('format').notNull(),
  importedAt: text('imported_at').notNull(),
  rowCount: integer('row_count'),
  fieldMapping: text('field_mapping'),
  storedFile: text('stored_file'),
})

export const species = sqliteTable('species', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  commonName: text('common_name').notNull(),
  commonNameRegex: text('common_name_regex'),
  scientificName: text('scientific_name').notNull(),
  scientificNameRegex: text('scientific_name_regex'),
  family: text('family'),
})

export const locationRegex = sqliteTable('location_regex', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  siteName: text('site_name').notNull(),
  regex: text('regex').notNull(),
  matchName: text('match_name'),
})

export const locationMatchCache = sqliteTable('location_match_cache', {
  rawString: text('raw_string').primaryKey(),
  locationId: integer('location_id').references(() => locations.id),
  confirmedAt: text('confirmed_at').notNull(),
})

// Key-value store for app-wide settings (e.g. LBC ID sequence counter)
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
