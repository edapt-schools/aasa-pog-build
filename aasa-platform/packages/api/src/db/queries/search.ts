import { sql } from 'drizzle-orm'
import { getDb } from '../index.js'
import type { SemanticSearchResponse } from '@aasa-platform/shared'

export interface VectorSearchOptions {
  embedding: number[]
  distanceThreshold?: number
  limit?: number
  state?: string
}

export interface KeywordSearchOptions {
  query: string
  limit?: number
  state?: string
  documentType?: string
}

/**
 * Search by vector embedding similarity
 * Uses pgvector cosine distance with HNSW index
 */
export async function searchByEmbedding(
  options: VectorSearchOptions
): Promise<SemanticSearchResponse['results']> {
  const db = getDb()

  // Convert embedding to pgvector format
  const embeddingString = JSON.stringify(options.embedding)

  // Distance threshold (lower = more similar)
  const distanceThreshold = options.distanceThreshold || 0.5
  const limit = options.limit || 20

  // Build query
  let query = sql`
    SELECT
      e.id as embedding_id,
      e.chunk_text,
      e.chunk_index,
      d.id as document_id,
      d.nces_id,
      d.document_url,
      d.document_type,
      d.document_title,
      d.document_category,
      dist.id as district_id,
      dist.nces_id as district_nces_id,
      dist.name as district_name,
      dist.state,
      dist.city,
      dist.superintendent_name,
      dist.superintendent_email,
      e.embedding <=> ${embeddingString}::vector as distance
    FROM document_embeddings e
    JOIN district_documents d ON e.document_id = d.id
    JOIN districts dist ON d.nces_id = dist.nces_id
    WHERE e.embedding <=> ${embeddingString}::vector < ${distanceThreshold}
  `

  // Add state filter if specified
  if (options.state) {
    query = sql`${query} AND dist.state = ${options.state}`
  }

  // Order by similarity and limit results
  query = sql`
    ${query}
    ORDER BY distance ASC
    LIMIT ${limit}
  `

  const results = await db.execute(query)

  // Transform results
  return results.map((row: any) => ({
    document: {
      id: row.document_id,
      ncesId: row.nces_id,
      documentUrl: row.document_url,
      documentType: row.document_type,
      documentTitle: row.document_title,
      documentCategory: row.document_category,
      extractedText: null,
      textLength: null,
      extractionMethod: null,
      pageDepth: null,
      discoveredAt: null,
      lastCrawledAt: null,
      contentHash: null,
    },
    district: {
      id: row.district_id,
      ncesId: row.district_nces_id,
      name: row.district_name,
      state: row.state,
      city: row.city,
      county: null,
      enrollment: null,
      gradesServed: null,
      localeCode: null,
      frplPercent: null,
      minorityPercent: null,
      websiteDomain: null,
      superintendentName: row.superintendent_name,
      superintendentEmail: row.superintendent_email,
      phone: null,
      address: null,
      lastScrapedAt: null,
      scrapeStatus: null,
      scrapeError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    chunkText: row.chunk_text,
    distance: parseFloat(row.distance),
    relevanceScore: 1 - parseFloat(row.distance) / 2, // Convert distance to 0-1 score
  }))
}

/**
 * Search documents by keyword (full-text search)
 * Uses PostgreSQL ILIKE for simple text matching
 */
export async function searchByKeyword(options: KeywordSearchOptions) {
  const db = getDb()

  const limit = options.limit || 20

  // Build query with ILIKE for keyword search
  let query = sql`
    SELECT
      d.id as document_id,
      d.nces_id,
      d.document_url,
      d.document_type,
      d.document_title,
      d.document_category,
      d.extracted_text,
      dist.id as district_id,
      dist.name as district_name,
      dist.state,
      dist.city,
      dist.superintendent_name,
      dist.superintendent_email
    FROM district_documents d
    JOIN districts dist ON d.nces_id = dist.nces_id
    WHERE d.extracted_text ILIKE ${'%' + options.query + '%'}
  `

  // Add filters
  if (options.state) {
    query = sql`${query} AND dist.state = ${options.state}`
  }

  if (options.documentType) {
    query = sql`${query} AND d.document_type = ${options.documentType}`
  }

  // Order by relevance (document title match preferred)
  query = sql`
    ${query}
    ORDER BY
      CASE WHEN d.document_title ILIKE ${'%' + options.query + '%'} THEN 1 ELSE 2 END,
      d.document_title
    LIMIT ${limit}
  `

  const results = await db.execute(query)

  return results.map((row: any) => ({
    document: {
      id: row.document_id,
      ncesId: row.nces_id,
      documentUrl: row.document_url,
      documentType: row.document_type,
      documentTitle: row.document_title,
      documentCategory: row.document_category,
      extractedText: row.extracted_text?.substring(0, 500), // Truncate for preview
    },
    district: {
      id: row.district_id,
      name: row.district_name,
      state: row.state,
      city: row.city,
      superintendentName: row.superintendent_name,
      superintendentEmail: row.superintendent_email,
    },
  }))
}

/**
 * Get related documents by finding nearest neighbors to an existing embedding
 */
export async function findRelatedDocuments(documentId: string, limit: number = 10) {
  const db = getDb()

  // First, get the embedding for the given document
  const embeddingResult = await db.execute(sql`
    SELECT embedding
    FROM document_embeddings
    WHERE document_id = ${documentId}
    LIMIT 1
  `)

  if (embeddingResult.length === 0) {
    return []
  }

  const embedding = embeddingResult[0].embedding

  // Find similar documents (excluding the original)
  const results = await db.execute(sql`
    SELECT
      e.id as embedding_id,
      e.chunk_text,
      d.id as document_id,
      d.document_url,
      d.document_title,
      d.document_type,
      dist.name as district_name,
      dist.state,
      e.embedding <=> ${embedding}::vector as distance
    FROM document_embeddings e
    JOIN district_documents d ON e.document_id = d.id
    JOIN districts dist ON d.nces_id = dist.nces_id
    WHERE e.document_id != ${documentId}
    ORDER BY distance ASC
    LIMIT ${limit}
  `)

  return results.map((row: any) => ({
    documentId: row.document_id,
    documentUrl: row.document_url,
    documentTitle: row.document_title,
    documentType: row.document_type,
    districtName: row.district_name,
    state: row.state,
    chunkText: row.chunk_text,
    distance: parseFloat(row.distance),
    relevanceScore: 1 - parseFloat(row.distance) / 2,
  }))
}

/**
 * Search within a specific district's documents
 */
export async function searchDistrictDocuments(
  ncesId: string,
  query: string,
  limit: number = 10
) {
  const db = getDb()

  const results = await db.execute(sql`
    SELECT
      d.id as document_id,
      d.document_url,
      d.document_title,
      d.document_type,
      d.document_category,
      d.extracted_text
    FROM district_documents d
    WHERE d.nces_id = ${ncesId}
      AND d.extracted_text ILIKE ${'%' + query + '%'}
    ORDER BY
      CASE WHEN d.document_title ILIKE ${'%' + query + '%'} THEN 1 ELSE 2 END,
      d.document_title
    LIMIT ${limit}
  `)

  return results.map((row: any) => ({
    documentId: row.document_id,
    documentUrl: row.document_url,
    documentTitle: row.document_title,
    documentType: row.document_type,
    documentCategory: row.document_category,
    extractedText: row.extracted_text?.substring(0, 500),
  }))
}
