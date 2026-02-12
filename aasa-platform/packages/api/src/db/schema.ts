/**
 * Drizzle ORM Schema for AASA District Intelligence Platform
 *
 * Maps existing Supabase PostgreSQL database with 100% accuracy.
 * Database contains 19,740 districts with 61.4% superintendent coverage.
 *
 * Architecture:
 * - AUDIT LAYER: data_imports, quality_flags
 * - SOURCE LAYER: districts, ccd_staff_data, state_registry_districts
 * - MATCHING LAYER: district_matches
 * - DOCUMENT LAYER: district_documents, document_crawl_log, district_keyword_scores, document_embeddings
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  decimal,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { vector } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// =============================================================================
// AUDIT LAYER - Import tracking and data quality
// =============================================================================

/**
 * Tracks all data imports with audit trail
 * Every import operation creates a record here
 */
export const dataImports = pgTable('data_imports', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceType: varchar('source_type', { length: 50 }).notNull(), // 'nces', 'ccd', 'state_registry', 'crawl'
  sourceName: varchar('source_name', { length: 100 }), // e.g., "California CDE"
  sourceUrl: text('source_url'), // Where data came from
  sourceFile: varchar('source_file', { length: 255 }), // e.g., "md_superintendents.csv"
  recordCount: integer('record_count'), // Total records in source
  successCount: integer('success_count'), // Successfully loaded
  errorCount: integer('error_count'), // Failed records
  errorLog: jsonb('error_log'), // Detailed error information
  importedAt: timestamp('imported_at').defaultNow().notNull(),
  importedBy: varchar('imported_by', { length: 100 }), // Script/agent name
  checksum: varchar('checksum', { length: 64 }), // SHA-256 of source file
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceTypeIdx: index('idx_data_imports_source_type').on(table.sourceType),
  importedAtIdx: index('idx_data_imports_imported_at').on(table.importedAt),
}))

/**
 * Tracks data quality issues for resolution
 */
export const qualityFlags = pgTable('quality_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  districtId: uuid('district_id'), // FK to districts (nullable)
  stateRegistryId: uuid('state_registry_id'), // FK to state_registry_districts (nullable)
  sourceTable: varchar('source_table', { length: 50 }).notNull(), // Where issue found
  flagType: varchar('flag_type', { length: 50 }).notNull(), // 'missing_field', 'mismatch', 'stale'
  fieldName: varchar('field_name', { length: 100 }), // Which field (if applicable)
  description: text('description'), // Human-readable issue
  severity: varchar('severity', { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
  resolved: boolean('resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: varchar('resolved_by', { length: 100 }),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  districtIdIdx: index('idx_quality_flags_district').on(table.districtId),
  resolvedIdx: index('idx_quality_flags_resolved').on(table.resolved),
  flagTypeIdx: index('idx_quality_flags_type').on(table.flagType),
}))

// =============================================================================
// SOURCE LAYER - Immutable base data
// =============================================================================

/**
 * NCES Baseline - Authoritative source for all US public school districts
 * Federal data - considered immutable/authoritative
 */
export const districts = pgTable('districts', {
  id: uuid('id').defaultRandom().primaryKey(),
  ncesId: varchar('nces_id', { length: 20 }), // NCES LEA ID (authoritative) - nullable in DB
  name: varchar('name', { length: 500 }).notNull(), // Official district name
  state: varchar('state', { length: 2 }).notNull(), // State abbreviation
  city: varchar('city', { length: 255 }),
  county: varchar('county', { length: 255 }),
  enrollment: integer('enrollment'), // Student count
  gradesServed: varchar('grades_served', { length: 50 }),
  localeCode: varchar('locale_code', { length: 10 }),
  frplPercent: decimal('frpl_percent'), // Free/Reduced Price Lunch percentage
  minorityPercent: decimal('minority_percent'), // Minority enrollment percentage
  websiteDomain: varchar('website_domain', { length: 500 }),
  superintendentName: varchar('superintendent_name', { length: 255 }),
  superintendentEmail: varchar('superintendent_email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  lastScrapedAt: timestamp('last_scraped_at'),
  scrapeStatus: varchar('scrape_status', { length: 50 }),
  scrapeError: text('scrape_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ncesIdIdx: uniqueIndex('idx_districts_nces_id').on(table.ncesId),
  stateIdx: index('idx_districts_state').on(table.state),
}))

/**
 * CCD Staff Data - Federal enrichment from Common Core of Data
 * Additional details about districts from federal source
 */
export const ccdStaffData = pgTable('ccd_staff_data', {
  id: uuid('id').defaultRandom().primaryKey(),
  ncesId: varchar('nces_id', { length: 20 }).notNull(), // Links to districts
  districtName: varchar('district_name', { length: 500 }),
  state: varchar('state', { length: 2 }),
  websiteUrl: text('website_url'),
  phone: varchar('phone', { length: 50 }),
  mailingAddress: text('mailing_address'),
  mailingCity: varchar('mailing_city', { length: 255 }),
  mailingState: varchar('mailing_state', { length: 2 }),
  mailingZip: varchar('mailing_zip', { length: 20 }),
  physicalAddress: text('physical_address'),
  physicalCity: varchar('physical_city', { length: 255 }),
  physicalState: varchar('physical_state', { length: 2 }),
  physicalZip: varchar('physical_zip', { length: 20 }),
  enrollment: integer('enrollment'),
  gradesServed: varchar('grades_served', { length: 50 }),
  leaType: varchar('lea_type', { length: 255 }),
  operationalSchools: integer('operational_schools'),
  isCharter: boolean('is_charter'),
  status: varchar('status', { length: 50 }),
  superintendentName: varchar('superintendent_name', { length: 255 }),
  superintendentEmail: varchar('superintendent_email', { length: 255 }),
  sourceFile: varchar('source_file', { length: 255 }),
  schoolYear: varchar('school_year', { length: 20 }),
  extractedAt: timestamp('extracted_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ncesIdIdx: index('idx_ccd_staff_nces_id').on(table.ncesId),
}))

/**
 * State Registry Districts - Raw records from state Departments of Education
 * Multiple rows per district possible (different state sources)
 */
export const stateRegistryDistricts = pgTable('state_registry_districts', {
  id: uuid('id').defaultRandom().primaryKey(),
  state: varchar('state', { length: 2 }).notNull(),
  stateDistrictId: varchar('state_district_id', { length: 50 }).notNull(), // State's own ID
  districtName: varchar('district_name', { length: 500 }).notNull(),
  county: varchar('county', { length: 255 }),
  city: varchar('city', { length: 255 }),
  address: text('address'),
  street: varchar('street', { length: 500 }),
  zip: varchar('zip', { length: 20 }),
  mailStreet: varchar('mail_street', { length: 500 }),
  mailCity: varchar('mail_city', { length: 255 }),
  mailZip: varchar('mail_zip', { length: 20 }),
  mailState: varchar('mail_state', { length: 2 }),
  phone: varchar('phone', { length: 50 }),
  phoneExt: varchar('phone_ext', { length: 20 }),
  fax: varchar('fax', { length: 50 }),
  administratorFirstName: varchar('administrator_first_name', { length: 255 }),
  administratorLastName: varchar('administrator_last_name', { length: 255 }),
  administratorEmail: varchar('administrator_email', { length: 255 }),
  websiteUrl: text('website_url'),
  latitude: decimal('latitude'),
  longitude: decimal('longitude'),
  districtType: varchar('district_type', { length: 255 }),
  districtTypeCode: varchar('district_type_code', { length: 10 }),
  status: varchar('status', { length: 50 }),
  sourceUrl: text('source_url'),
  lastUpdatedBySource: varchar('last_updated_by_source', { length: 50 }),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  importBatchId: uuid('import_batch_id'), // FK to data_imports
}, (table) => ({
  stateIdx: index('idx_state_registry_state').on(table.state),
  districtNameIdx: index('idx_state_registry_name').on(table.districtName),
}))

// =============================================================================
// MATCHING LAYER - Links state data to NCES baseline
// =============================================================================

/**
 * District Matches - Maps state registry records to NCES districts
 * Uses various matching strategies (exact ID, fuzzy name, etc.)
 */
export const districtMatches = pgTable('district_matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  ncesId: varchar('nces_id', { length: 20 }).notNull(), // Links to districts
  stateRegistryId: uuid('state_registry_id').notNull(), // Links to state_registry_districts
  matchMethod: varchar('match_method', { length: 50 }).notNull(), // 'exact_id', 'exact_name', 'normalized_name', 'fuzzy', 'manual'
  matchConfidence: decimal('match_confidence').notNull(), // 0.00 to 1.00
  matchDetails: jsonb('match_details'), // Algorithm output, scoring
  matchedAt: timestamp('matched_at').defaultNow().notNull(),
  matchedBy: varchar('matched_by', { length: 100 }), // Agent/script name
  verified: boolean('verified').default(false),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: varchar('verified_by', { length: 100 }),
  flagForReview: boolean('flag_for_review').default(false),
  reviewReason: text('review_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  ncesIdIdx: index('idx_district_matches_nces').on(table.ncesId),
  stateRegistryIdIdx: index('idx_district_matches_state_registry').on(table.stateRegistryId),
  confidenceIdx: index('idx_district_matches_confidence').on(table.matchConfidence),
  methodIdx: index('idx_district_matches_method').on(table.matchMethod),
  flagForReviewIdx: index('idx_district_matches_flag').on(table.flagForReview),
}))

// =============================================================================
// DOCUMENT LAYER - Crawled content and semantic search
// =============================================================================

/**
 * District Documents - Extracted content from crawled websites
 * Stores URLs and text from PDFs and HTML pages
 */
export const districtDocuments = pgTable('district_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  ncesId: varchar('nces_id', { length: 20 }).notNull(), // Links to districts
  documentUrl: text('document_url').notNull(), // Full URL
  documentType: varchar('document_type', { length: 20 }).notNull(), // 'pdf', 'html', 'embedded_pdf'
  documentTitle: text('document_title'), // Human-readable title
  documentCategory: varchar('document_category', { length: 50 }), // 'portrait_of_graduate', 'strategic_plan', 'other'
  extractedText: text('extracted_text'), // Full text (up to 100KB)
  textLength: integer('text_length'), // Length of extracted_text
  extractionMethod: varchar('extraction_method', { length: 30 }), // 'pdf_parse', 'html_scrape', 'ocr'
  pageDepth: integer('page_depth').default(0), // 0=homepage, 1=linked, 2=deep
  discoveredAt: timestamp('discovered_at').defaultNow(),
  lastCrawledAt: timestamp('last_crawled_at'),
  contentHash: varchar('content_hash', { length: 64 }), // SHA256 of extracted_text
}, (table) => ({
  ncesIdIdx: index('idx_district_documents_nces').on(table.ncesId),
  categoryIdx: index('idx_district_documents_category').on(table.documentCategory),
  // Unique: prevent duplicate documents
  ncesUrlUnique: uniqueIndex('idx_district_documents_unique')
    .on(table.ncesId, table.documentUrl),
}))

/**
 * Document Crawl Log - Audit trail of all crawl attempts
 * Logs success and failure for learning and recovery
 */
export const documentCrawlLog = pgTable('document_crawl_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  ncesId: varchar('nces_id', { length: 20 }).notNull(),
  crawlBatchId: uuid('crawl_batch_id').notNull(), // Groups crawls together
  url: text('url').notNull(), // URL attempted
  urlType: varchar('url_type', { length: 20 }), // 'homepage', 'internal_link', 'pdf_link'

  // Status tracking
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'failure', 'skipped', 'timeout'
  httpStatus: integer('http_status'), // 200, 404, etc.
  errorMessage: text('error_message'), // Error details if failed

  contentType: varchar('content_type', { length: 100 }), // MIME type
  documentId: uuid('document_id'), // FK to district_documents if saved
  extractionSuccess: boolean('extraction_success'),

  // Keyword detection
  keywordsFound: text('keywords_found').array(), // TEXT[] - matched keywords

  responseTimeMs: integer('response_time_ms'), // Request duration
  crawledAt: timestamp('crawled_at').defaultNow().notNull(),
}, (table) => ({
  batchIdx: index('idx_crawl_log_batch').on(table.crawlBatchId),
  statusIdx: index('idx_crawl_log_status').on(table.status),
  ncesIdx: index('idx_crawl_log_nces').on(table.ncesId),
}))

/**
 * District Keyword Scores - Taxonomy-based scoring for outreach prioritization
 * 4 categories: Readiness, Alignment, Activation, Branding
 */
export const districtKeywordScores = pgTable('district_keyword_scores', {
  id: uuid('id').defaultRandom().primaryKey(),
  ncesId: varchar('nces_id', { length: 20 }).notNull().unique(), // One row per district

  // Category scores (0-10 scale)
  readinessScore: decimal('readiness_score'), // Portrait of Graduate, Strategic Plan
  alignmentScore: decimal('alignment_score'), // Educator competencies, frameworks
  activationScore: decimal('activation_score'), // Capstone, Cornerstone, Performance tasks
  brandingScore: decimal('branding_score'), // Storytelling, messaging

  totalScore: decimal('total_score'), // Average of 4 categories
  outreachTier: varchar('outreach_tier', { length: 10 }), // 'tier1', 'tier2', 'tier3'

  // Evidence tracking
  keywordMatches: jsonb('keyword_matches'), // {category: [{keyword, weight, source_doc, context}]}
  documentsAnalyzed: integer('documents_analyzed'), // Number of documents scored

  scoredAt: timestamp('scored_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  ncesIdIdx: uniqueIndex('idx_keyword_scores_nces').on(table.ncesId),
  tierIdx: index('idx_keyword_scores_tier').on(table.outreachTier),
}))

/**
 * Document Embeddings - Vector embeddings for semantic search
 * Uses pgvector extension with OpenAI text-embedding-3-small embeddings (1536 dimensions)
 */
export const documentEmbeddings = pgTable('document_embeddings', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull(), // FK to district_documents
  chunkIndex: integer('chunk_index').default(0).notNull(), // Position in document
  chunkText: text('chunk_text').notNull(), // Original text (~1500 chars)

  // Vector column - 1536 dimensions for OpenAI text-embedding-3-small
  embedding: vector('embedding', { dimensions: 1536 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  documentIdIdx: index('idx_embeddings_document').on(table.documentId),
  // Note: IVFFlat index created manually in migration after data load
  // CREATE INDEX idx_embeddings_vector ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
}))

// =============================================================================
// USER LAYER - Cohorts, saved searches, and user state
// =============================================================================

/**
 * Saved Cohorts - Named collections of districts curated by users
 */
export const savedCohorts = pgTable('saved_cohorts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(), // Supabase auth user ID or email
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_saved_cohorts_user').on(table.userId),
}))

/**
 * Saved Cohort Items - Individual districts within a cohort
 */
export const savedCohortItems = pgTable('saved_cohort_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  cohortId: uuid('cohort_id').notNull(), // FK to saved_cohorts
  ncesId: varchar('nces_id', { length: 20 }).notNull(),
  notes: text('notes'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => ({
  cohortIdIdx: index('idx_cohort_items_cohort').on(table.cohortId),
  cohortNcesUnique: uniqueIndex('idx_cohort_items_unique').on(table.cohortId, table.ncesId),
}))

/**
 * Saved Searches - Persisted search queries for re-running
 */
export const savedSearches = pgTable('saved_searches', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  query: text('query').notNull(), // The prompt text
  intent: varchar('intent', { length: 50 }),
  filters: jsonb('filters'), // Grant criteria, lead filters, etc.
  resultCount: integer('result_count'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_saved_searches_user').on(table.userId),
}))

/**
 * Command Search Logs - telemetry for Command Center query quality analysis
 */
export const commandSearchLogs = pgTable('command_search_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id'),
  prompt: text('prompt').notNull(),
  intent: varchar('intent', { length: 50 }),
  confidenceThreshold: decimal('confidence_threshold'),
  leadFilters: jsonb('lead_filters'),
  grantCriteria: jsonb('grant_criteria'),
  suppressionDays: integer('suppression_days'),
  resultCount: integer('result_count'),
  topNcesIds: text('top_nces_ids').array(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_command_search_logs_user').on(table.userId),
  intentIdx: index('idx_command_search_logs_intent').on(table.intent),
  generatedAtIdx: index('idx_command_search_logs_generated_at').on(table.generatedAt),
}))

// =============================================================================
// Relations - Drizzle ORM relationships for type-safe joins
// =============================================================================

export const districtsRelations = relations(districts, ({ one, many }) => ({
  ccdData: one(ccdStaffData, {
    fields: [districts.ncesId],
    references: [ccdStaffData.ncesId],
  }),
  match: one(districtMatches, {
    fields: [districts.ncesId],
    references: [districtMatches.ncesId],
  }),
  documents: many(districtDocuments),
  keywordScores: one(districtKeywordScores, {
    fields: [districts.ncesId],
    references: [districtKeywordScores.ncesId],
  }),
}))

export const districtMatchesRelations = relations(districtMatches, ({ one }) => ({
  district: one(districts, {
    fields: [districtMatches.ncesId],
    references: [districts.ncesId],
  }),
  stateRegistry: one(stateRegistryDistricts, {
    fields: [districtMatches.stateRegistryId],
    references: [stateRegistryDistricts.id],
  }),
}))

export const districtDocumentsRelations = relations(districtDocuments, ({ one, many }) => ({
  district: one(districts, {
    fields: [districtDocuments.ncesId],
    references: [districts.ncesId],
  }),
  embeddings: many(documentEmbeddings),
  crawlLogs: many(documentCrawlLog),
}))

export const documentEmbeddingsRelations = relations(documentEmbeddings, ({ one }) => ({
  document: one(districtDocuments, {
    fields: [documentEmbeddings.documentId],
    references: [districtDocuments.id],
  }),
}))

export const savedCohortsRelations = relations(savedCohorts, ({ many }) => ({
  items: many(savedCohortItems),
}))

export const savedCohortItemsRelations = relations(savedCohortItems, ({ one }) => ({
  cohort: one(savedCohorts, {
    fields: [savedCohortItems.cohortId],
    references: [savedCohorts.id],
  }),
}))

// =============================================================================
// Type exports - Use with InferSelectModel for type-safe queries
// =============================================================================

export type District = typeof districts.$inferSelect
export type DistrictInsert = typeof districts.$inferInsert

export type DistrictDocument = typeof districtDocuments.$inferSelect
export type DistrictDocumentInsert = typeof districtDocuments.$inferInsert

export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect
export type DocumentEmbeddingInsert = typeof documentEmbeddings.$inferInsert

export type KeywordScore = typeof districtKeywordScores.$inferSelect
export type KeywordScoreInsert = typeof districtKeywordScores.$inferInsert

export type DistrictMatch = typeof districtMatches.$inferSelect
export type StateRegistryDistrict = typeof stateRegistryDistricts.$inferSelect

export type SavedCohort = typeof savedCohorts.$inferSelect
export type SavedCohortInsert = typeof savedCohorts.$inferInsert
export type SavedCohortItem = typeof savedCohortItems.$inferSelect
export type SavedCohortItemInsert = typeof savedCohortItems.$inferInsert
export type SavedSearch = typeof savedSearches.$inferSelect
export type SavedSearchInsert = typeof savedSearches.$inferInsert
export type CommandSearchLog = typeof commandSearchLogs.$inferSelect
export type CommandSearchLogInsert = typeof commandSearchLogs.$inferInsert
