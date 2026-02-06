import { sql, eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { generateEmbedding } from './embeddings.js'
import { districtKeywordScores, districts } from '../db/schema.js'
import type {
  SemanticSearchParams,
  SemanticSearchResponse,
  SimilarDocumentsResponse,
  KeywordEvidenceResponse,
  CategoryEvidence,
} from '@aasa-platform/shared'

/**
 * Semantic search using pgvector cosine similarity
 * Searches through document embeddings and returns matching districts + chunks
 */
export async function semanticSearch(
  params: SemanticSearchParams
): Promise<SemanticSearchResponse> {
  const db = getDb()

  // Generate embedding for search query
  const queryEmbedding = await generateEmbedding(params.query)

  // Convert to pgvector format: [1,2,3] -> '[1,2,3]'
  const embeddingString = JSON.stringify(queryEmbedding)

  // Distance threshold (lower = more similar)
  // Cosine distance: 0 = identical, 2 = completely different
  const distanceThreshold = params.distanceThreshold || 0.5
  const limit = params.limit || 20

  // Build query with pgvector similarity search
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
  if (params.state) {
    query = sql`${query} AND dist.state = ${params.state}`
  }

  // Add document type filter if specified
  if (params.documentTypes && params.documentTypes.length > 0) {
    query = sql`${query} AND d.document_type = ANY(${params.documentTypes}::text[])`
  }

  // Add date range filters if specified
  if (params.dateFrom) {
    query = sql`${query} AND d.last_crawled_at >= ${params.dateFrom}::date`
  }
  if (params.dateTo) {
    query = sql`${query} AND d.last_crawled_at <= ${params.dateTo}::date`
  }

  // Order by similarity and limit results
  query = sql`
    ${query}
    ORDER BY distance ASC
    LIMIT ${limit}
  `

  const results = await db.execute(query)

  // Transform results to match API types
  const searchResults = results.map((row: any) => ({
    document: {
      id: row.document_id,
      ncesId: row.nces_id,
      documentUrl: row.document_url,
      documentType: row.document_type,
      documentTitle: row.document_title,
      documentCategory: row.document_category,
      extractedText: null, // Don't return full text
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

  return {
    results: searchResults,
    query: params.query,
    total: searchResults.length,
  }
}

/**
 * Find similar documents using vector similarity
 * Uses the source document's embedding to find related documents
 */
export async function getSimilarDocuments(
  documentId: string,
  limit: number = 20
): Promise<SimilarDocumentsResponse> {
  const db = getDb()

  // First, get the embedding for the source document
  const sourceQuery = sql`
    SELECT embedding
    FROM document_embeddings
    WHERE document_id = ${documentId}
    LIMIT 1
  `
  const sourceResults = await db.execute(sourceQuery)

  if (sourceResults.length === 0) {
    throw new Error('Source document not found or has no embeddings')
  }

  const sourceEmbedding = (sourceResults[0] as any).embedding

  // Find similar documents using pgvector similarity
  const query = sql`
    SELECT DISTINCT
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
      e.embedding <=> ${sourceEmbedding}::vector as distance
    FROM document_embeddings e
    JOIN district_documents d ON e.document_id = d.id
    JOIN districts dist ON d.nces_id = dist.nces_id
    WHERE
      e.document_id != ${documentId}
      AND e.embedding <=> ${sourceEmbedding}::vector < 0.7
    ORDER BY distance ASC
    LIMIT ${limit}
  `

  const results = await db.execute(query)

  // Transform results to match API types
  const similarDocuments = results.map((row: any) => ({
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
    similarity: 1 - parseFloat(row.distance) / 2, // Convert distance to 0-1 similarity score
  }))

  return {
    results: similarDocuments,
    sourceDocumentId: documentId,
    total: similarDocuments.length,
  }
}

/**
 * Get keyword evidence for a district
 * Returns keyword scores and evidence from the 4-category taxonomy
 */
export async function getKeywordEvidence(ncesId: string): Promise<KeywordEvidenceResponse> {
  const db = getDb()

  // Get district and keyword scores
  const result = await db
    .select({
      districtName: districts.name,
      readinessScore: districtKeywordScores.readinessScore,
      alignmentScore: districtKeywordScores.alignmentScore,
      activationScore: districtKeywordScores.activationScore,
      brandingScore: districtKeywordScores.brandingScore,
      totalScore: districtKeywordScores.totalScore,
      keywordMatches: districtKeywordScores.keywordMatches,
      scoredAt: districtKeywordScores.scoredAt,
    })
    .from(districts)
    .leftJoin(districtKeywordScores, eq(districts.ncesId, districtKeywordScores.ncesId))
    .where(eq(districts.ncesId, ncesId))
    .limit(1)

  if (result.length === 0) {
    throw new Error('District not found')
  }

  const data = result[0]

  // Helper function to parse category evidence from JSONB
  const parseCategoryEvidence = (categoryKey: string): CategoryEvidence | null => {
    if (!data.keywordMatches) return null

    const keywordMatches = data.keywordMatches as any
    const categoryData = keywordMatches[categoryKey]

    if (!categoryData) return null

    // Extract keywords, mentions, and document excerpts
    const keywordsFound: string[] = []
    const documentsMap = new Map<string, { documentId: string; documentType: string; text: string; keywords: string[] }>()
    let totalMentions = 0

    if (Array.isArray(categoryData)) {
      categoryData.forEach((match: any) => {
        if (match.keyword && !keywordsFound.includes(match.keyword)) {
          keywordsFound.push(match.keyword)
        }
        if (match.count) {
          totalMentions += match.count
        }
        if (match.context && match.document_id) {
          const docKey = match.document_id
          if (!documentsMap.has(docKey)) {
            documentsMap.set(docKey, {
              documentId: match.document_id,
              documentType: match.document_type || 'unknown',
              text: '',
              keywords: [],
            })
          }
          const doc = documentsMap.get(docKey)!
          // Append context to text (limit to ~1000 chars)
          if (match.context && doc.text.length < 1000) {
            doc.text += (doc.text ? '\n\n' : '') + match.context
          }
          // Add keyword if not already present
          if (match.keyword && !doc.keywords.includes(match.keyword)) {
            doc.keywords.push(match.keyword)
          }
        }
      })
    }

    return {
      score: null, // Will be filled below
      keywordsFound,
      totalMentions,
      documents: Array.from(documentsMap.values()),
    }
  }

  // Parse evidence for each category
  const readiness = parseCategoryEvidence('readiness')
  const alignment = parseCategoryEvidence('alignment')
  const activation = parseCategoryEvidence('activation')
  const branding = parseCategoryEvidence('branding')

  // Add scores to evidence
  if (readiness) readiness.score = data.readinessScore ? parseFloat(data.readinessScore) : null
  if (alignment) alignment.score = data.alignmentScore ? parseFloat(data.alignmentScore) : null
  if (activation) activation.score = data.activationScore ? parseFloat(data.activationScore) : null
  if (branding) branding.score = data.brandingScore ? parseFloat(data.brandingScore) : null

  return {
    ncesId,
    districtName: data.districtName,
    readiness,
    alignment,
    activation,
    branding,
    totalScore: data.totalScore ? parseFloat(data.totalScore) : null,
    scoredAt: data.scoredAt ? data.scoredAt.toISOString() : null,
  }
}
