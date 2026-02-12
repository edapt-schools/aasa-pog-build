import { sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { generateEmbedding } from './embeddings.js'
import type {
  CommandRequest,
  CommandResponse,
  ConfidenceBand,
  SignalContribution,
  GrantCriteria,
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
      nr.id as district_id,
      nr.nces_id as district_nces_id,
      nr.district_name as district_name,
      nr.state,
      nr.city,
      nr.county,
      nr.enrollment,
      nr.grades_served,
      nr.locale_code,
      nr.website,
      nr.superintendent_name,
      nr.superintendent_email,
      nr.phone,
      e.embedding <=> ${embeddingString}::vector as distance
    FROM document_embeddings e
    JOIN district_documents d ON e.document_id = d.id
    JOIN national_registry nr ON d.nces_id = nr.nces_id
    WHERE e.embedding <=> ${embeddingString}::vector < ${distanceThreshold}
      AND nr.nces_id IS NOT NULL
  `

  // Add state filter if specified
  if (params.state) {
    query = sql`${query} AND nr.state = ${params.state}`
  }

  // Add document type filter if specified
  if (params.documentTypes && params.documentTypes.length > 0) {
    query = sql`${query} AND d.document_type IN (${sql.join(params.documentTypes.map(t => sql`${t}`), sql`, `)})`
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
      county: row.county || null,
      enrollment: row.enrollment ?? null,
      gradesServed: row.grades_served || null,
      localeCode: row.locale_code || null,
      frplPercent: null,
      minorityPercent: null,
      websiteDomain: row.website || null,
      superintendentName: row.superintendent_name,
      superintendentEmail: row.superintendent_email,
      phone: row.phone || null,
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
      nr.id as district_id,
      nr.nces_id as district_nces_id,
      nr.district_name as district_name,
      nr.state,
      nr.city,
      nr.county,
      nr.enrollment,
      nr.grades_served,
      nr.locale_code,
      nr.website,
      nr.superintendent_name,
      nr.superintendent_email,
      nr.phone,
      e.embedding <=> ${sourceEmbedding}::vector as distance
    FROM document_embeddings e
    JOIN district_documents d ON e.document_id = d.id
    JOIN national_registry nr ON d.nces_id = nr.nces_id
    WHERE
      e.document_id != ${documentId}
      AND nr.nces_id IS NOT NULL
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
      county: row.county || null,
      enrollment: row.enrollment ?? null,
      gradesServed: row.grades_served || null,
      localeCode: row.locale_code || null,
      frplPercent: null,
      minorityPercent: null,
      websiteDomain: row.website || null,
      superintendentName: row.superintendent_name,
      superintendentEmail: row.superintendent_email,
      phone: row.phone || null,
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

  // Use golden merged district naming from national_registry.
  const result = await db.execute(sql`
    SELECT
      COALESCE(nr.district_name, d.name) AS district_name,
      ks.readiness_score,
      ks.alignment_score,
      ks.activation_score,
      ks.branding_score,
      ks.total_score,
      ks.keyword_matches,
      ks.scored_at
    FROM districts d
    LEFT JOIN national_registry nr ON nr.nces_id = d.nces_id
    LEFT JOIN district_keyword_scores ks ON d.nces_id = ks.nces_id
    WHERE d.nces_id = ${ncesId}
    LIMIT 1
  `)

  if (result.length === 0) {
    throw new Error('District not found')
  }

  const data = result[0] as any

  // Helper function to parse category evidence from JSONB
  const parseCategoryEvidence = (categoryKey: string): CategoryEvidence | null => {
    if (!data.keyword_matches) return null

    const keywordMatches = data.keyword_matches as any
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
  if (readiness) readiness.score = data.readiness_score ? parseFloat(data.readiness_score) : null
  if (alignment) alignment.score = data.alignment_score ? parseFloat(data.alignment_score) : null
  if (activation) activation.score = data.activation_score ? parseFloat(data.activation_score) : null
  if (branding) branding.score = data.branding_score ? parseFloat(data.branding_score) : null

  return {
    ncesId,
    districtName: data.district_name,
    readiness,
    alignment,
    activation,
    branding,
    totalScore: data.total_score ? parseFloat(data.total_score) : null,
    scoredAt: data.scored_at ? new Date(data.scored_at).toISOString() : null,
  }
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toConfidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.6) return 'medium'
  return 'low'
}

/**
 * Generate a dynamic, per-district "Why this district" summary.
 * Uses score categories, keyword matches, and semantic signals.
 */
function generateWhySummary(
  districtName: string,
  scores: { readiness: number; alignment: number; activation: number; branding: number },
  semanticMax: number,
  sourceExcerpts: Array<{ keyword: string }>,
): string {
  const ranked = [
    { label: 'readiness', value: scores.readiness },
    { label: 'alignment', value: scores.alignment },
    { label: 'activation', value: scores.activation },
    { label: 'branding', value: scores.branding },
  ].sort((a, b) => b.value - a.value)

  const strongCategories = ranked.filter((c) => c.value >= 3.0)
  const topKeywords = [...new Set(sourceExcerpts.map((e) => e.keyword).filter(Boolean))].slice(0, 3)

  const parts: string[] = []

  // Lead with the strongest category
  if (strongCategories.length > 0) {
    const topLabel = strongCategories[0].label
    const topValue = strongCategories[0].value.toFixed(1)
    const labelMap: Record<string, string> = {
      readiness: 'readiness for change',
      alignment: 'instructional alignment',
      activation: 'active engagement',
      branding: 'communications and branding',
    }
    parts.push(`${districtName} shows strong ${labelMap[topLabel] || topLabel} signals (${topValue})`)
  } else {
    parts.push(`${districtName} has moderate signals across scoring categories`)
  }

  // Add semantic context if meaningful
  if (semanticMax >= 0.7) {
    parts.push('with high semantic relevance to your query')
  } else if (semanticMax >= 0.5) {
    parts.push('with moderate semantic relevance to your query')
  }

  // Add keyword evidence
  if (topKeywords.length > 0) {
    const kwStr = topKeywords.map((k) => k.replace(/_/g, ' ')).join(', ')
    parts.push(`Evidence includes ${kwStr}`)
  }

  // Add secondary category if relevant
  if (strongCategories.length >= 2) {
    const secondary = strongCategories[1]
    const labelMap: Record<string, string> = {
      readiness: 'readiness',
      alignment: 'alignment',
      activation: 'activation',
      branding: 'branding',
    }
    parts.push(`also scoring well in ${labelMap[secondary.label] || secondary.label} (${secondary.value.toFixed(1)})`)
  }

  return parts.join(', ') + '.'
}

function extractGrantCriteria(prompt: string, attachmentText?: string): GrantCriteria {
  const source = `${prompt}\n${attachmentText || ''}`.toLowerCase()
  const frpl = source.match(/(?:frpl|free(?:\\s|-)reduced(?:\\s|-)lunch)[^\\d]{0,20}(\\d{1,3})\\s*%?/)
  const minority = source.match(/minority[^\\d]{0,20}(\\d{1,3})\\s*%?/)
  const enrollmentMin = source.match(/(?:enrollment|students)[^\\d]{0,20}(?:>=|over|above|at least)\\s*(\\d{2,7})/)

  const states = Array.from(
    new Set(
      (prompt.match(/\\b[A-Z]{2}\\b/g) || [])
        .map((code) => code.toUpperCase())
        .filter((code) => code !== 'AI' && code !== 'US')
    )
  )

  const requiredKeywords: string[] = []
  const keywordHints = [
    'portrait of a graduate',
    'measure what matters',
    'performance tasks',
    'competency',
    'strategic plan',
  ]
  for (const hint of keywordHints) {
    if (source.includes(hint)) requiredKeywords.push(hint)
  }

  return {
    frplMin: frpl ? Math.min(100, Number(frpl[1])) : undefined,
    minorityMin: minority ? Math.min(100, Number(minority[1])) : undefined,
    enrollmentMin: enrollmentMin ? Number(enrollmentMin[1]) : undefined,
    states: states.length > 0 ? states : undefined,
    requiredKeywords: requiredKeywords.length > 0 ? requiredKeywords : undefined,
  }
}

/**
 * Command orchestration endpoint backend:
 * - next hottest uncontacted leads
 * - grant matching with criteria extraction
 * - basic district search fallback
 */
export async function runCommand(request: CommandRequest): Promise<CommandResponse> {
  const db = getDb()
  const prompt = request.prompt.trim()
  const confidenceThreshold = request.confidenceThreshold ?? 0.6
  const lowerPrompt = prompt.toLowerCase()
  const requestedLimit = request.leadFilters?.limit || 25
  const queryEmbedding = await generateEmbedding(prompt)
  const embeddingString = JSON.stringify(queryEmbedding)

  const isLeadIntent =
    lowerPrompt.includes('next hottest') ||
    lowerPrompt.includes('uncontacted') ||
    lowerPrompt.includes('lead')
  const isGrantIntent =
    lowerPrompt.includes('grant') ||
    lowerPrompt.includes('frpl') ||
    lowerPrompt.includes('minority')
  const isInsightsIntent =
    lowerPrompt.includes('trend') ||
    lowerPrompt.includes('brief') ||
    lowerPrompt.includes('insight') ||
    lowerPrompt.includes('state overview')

  const intent = isInsightsIntent
    ? 'insights_briefing'
    : isGrantIntent
    ? 'grant_match'
    : isLeadIntent
      ? 'next_hottest_uncontacted'
      : 'district_search'

  const parsedGrantCriteria =
    intent === 'grant_match'
      ? {
          ...extractGrantCriteria(prompt, request.attachment?.textContent),
          ...(request.grantCriteria || {}),
        }
      : undefined

  const suppressionDays = request.engagementSignals?.suppressionDays ?? 60
  const nowMs = Date.now()
  const suppressedSet = new Set<string>()
  for (const event of request.engagementSignals?.events || []) {
    const deltaDays = (nowMs - new Date(event.happenedAt).getTime()) / (1000 * 60 * 60 * 24)
    if (deltaDays <= suppressionDays) {
      suppressedSet.add(event.ncesId)
    }
  }
  for (const excluded of request.leadFilters?.excludeNcesIds || []) {
    suppressedSet.add(excluded)
  }

  // Two-stage semantic search: pre-filter top-K most relevant chunks, then aggregate per district.
  // This avoids the old approach of scanning ALL 83K embeddings (which made every query return
  // the same districts since static keyword scores dominated the ranking).
  const rows = await db.execute(sql`
    WITH top_chunks AS (
      SELECT
        e.document_id,
        (1 - (e.embedding <=> ${embeddingString}::vector))::decimal AS similarity
      FROM document_embeddings e
      WHERE (1 - (e.embedding <=> ${embeddingString}::vector)) > 0.25
      ORDER BY e.embedding <=> ${embeddingString}::vector
      LIMIT 500
    ),
    semantic AS (
      SELECT
        dd.nces_id,
        MAX(tc.similarity)::decimal AS semantic_max,
        AVG(tc.similarity)::decimal AS semantic_avg,
        COUNT(*)::int AS semantic_hits
      FROM top_chunks tc
      JOIN district_documents dd ON tc.document_id = dd.id
      GROUP BY dd.nces_id
    )
    SELECT
      d.nces_id,
      d.name,
      d.state,
      d.city,
      d.enrollment,
      COALESCE(nr.website, d.website_domain) AS website_domain,
      COALESCE(nr.superintendent_name, d.superintendent_name) AS superintendent_name,
      COALESCE(nr.superintendent_email, d.superintendent_email) AS superintendent_email,
      COALESCE(nr.phone, d.phone) AS phone,
      d.frpl_percent,
      d.minority_percent,
      s.readiness_score,
      s.alignment_score,
      s.activation_score,
      s.branding_score,
      s.total_score,
      s.keyword_matches,
      COALESCE(semantic.semantic_max, 0)::decimal AS semantic_max,
      COALESCE(semantic.semantic_avg, 0)::decimal AS semantic_avg,
      COALESCE(semantic.semantic_hits, 0)::int AS semantic_hits
    FROM districts d
    LEFT JOIN national_registry nr ON d.nces_id = nr.nces_id
    LEFT JOIN district_keyword_scores s ON d.nces_id = s.nces_id
    LEFT JOIN semantic ON d.nces_id = semantic.nces_id
    WHERE d.nces_id IS NOT NULL
      AND (semantic.nces_id IS NOT NULL OR s.total_score IS NOT NULL)
    ORDER BY semantic_max DESC, s.total_score DESC NULLS LAST
  `)

  const rawRows = rows as any[]
  const withIds = rawRows.filter((row) => row.nces_id)
  const afterSuppression = withIds.filter((row) => !suppressedSet.has(row.nces_id))
  const afterState = afterSuppression.filter((row) => {
      if (!request.leadFilters?.states || request.leadFilters.states.length === 0) return true
      return request.leadFilters.states.includes(row.state)
    })
  const afterScoreThresholds = afterState
    .filter((row) => toNumber(row.total_score) >= (request.leadFilters?.minTotalScore ?? 0))
    .filter((row) => toNumber(row.readiness_score) >= (request.leadFilters?.minReadinessScore ?? 0))
    .filter((row) => toNumber(row.activation_score) >= (request.leadFilters?.minActivationScore ?? 0))
  const afterGrantCriteria = afterScoreThresholds
    .filter((row) => {
      if (!parsedGrantCriteria?.frplMin) return true
      return toNumber(row.frpl_percent) >= parsedGrantCriteria.frplMin
    })
    .filter((row) => {
      if (!parsedGrantCriteria?.minorityMin) return true
      return toNumber(row.minority_percent) >= parsedGrantCriteria.minorityMin
    })
    .filter((row) => {
      if (!parsedGrantCriteria?.states || parsedGrantCriteria.states.length === 0) return true
      return parsedGrantCriteria.states.includes(row.state)
    })
  const preConfidenceRows = afterGrantCriteria

  let districtsOut = preConfidenceRows
    .map((row) => {
      const readiness = toNumber(row.readiness_score)
      const alignment = toNumber(row.alignment_score)
      const activation = toNumber(row.activation_score)
      const branding = toNumber(row.branding_score)
      const total = toNumber(row.total_score)
      const semanticMax = toNumber(row.semantic_max)
      const semanticAvg = toNumber(row.semantic_avg)
      const semanticHits = toNumber(row.semantic_hits)
      const engagementPenalty = suppressedSet.has(row.nces_id) ? 2 : 0
      const eligibilityBoost =
        (parsedGrantCriteria?.frplMin && toNumber(row.frpl_percent) >= parsedGrantCriteria.frplMin ? 0.5 : 0) +
        (parsedGrantCriteria?.minorityMin && toNumber(row.minority_percent) >= parsedGrantCriteria.minorityMin ? 0.5 : 0)
      // Semantic relevance is the PRIMARY ranking signal (query-specific).
      // Keyword score is a secondary boost (static, same for every query).
      const semanticScore = (semanticMax * 6) + (semanticAvg * 2) + Math.min(1.5, Math.log10(semanticHits + 1))
      const keywordBoost = total * 0.5
      const composite = Math.max(0, semanticScore + keywordBoost + eligibilityBoost - engagementPenalty)
      const confidence = Math.min(0.98, Math.max(0.2, (composite + semanticAvg * 2) / 12))
      const confidenceBand = toConfidenceBand(confidence)
      const sourceExcerpts: Array<{ documentUrl?: string | null; keyword: string; excerpt: string }> = []
      const keywordMatches = (row.keyword_matches || {}) as Record<string, any[]>
      for (const matches of Object.values(keywordMatches)) {
        for (const match of Array.isArray(matches) ? matches.slice(0, 1) : []) {
          sourceExcerpts.push({
            documentUrl: match.source_doc || null,
            keyword: match.keyword || 'signal',
            excerpt: match.context || 'Signal matched in district documents.',
          })
        }
      }

      return {
        district: {
          id: row.nces_id,
          ncesId: row.nces_id,
          name: row.name,
          state: row.state,
          city: row.city,
          county: null,
          enrollment: row.enrollment,
          gradesServed: null,
          localeCode: null,
          frplPercent: row.frpl_percent ? String(row.frpl_percent) : null,
          minorityPercent: row.minority_percent ? String(row.minority_percent) : null,
          websiteDomain: row.website_domain,
          superintendentName: row.superintendent_name,
          superintendentEmail: row.superintendent_email,
          phone: row.phone || null,
          address: null,
          lastScrapedAt: null,
          scrapeStatus: null,
          scrapeError: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        score: {
          total,
          readiness,
          alignment,
          activation,
          branding,
          composite,
        },
        why: {
          ncesId: row.nces_id,
          confidence,
          confidenceBand,
          summary: generateWhySummary(
            row.name,
            { readiness, alignment, activation, branding },
            semanticMax,
            sourceExcerpts,
          ),
          topSignals: [
            { signal: 'semantic_max', category: 'semantic', weight: semanticMax, reason: `Top semantic similarity across ${semanticHits} matching chunks` },
            { signal: 'readiness_score', category: 'readiness', weight: readiness },
            { signal: 'activation_score', category: 'activation', weight: activation },
            { signal: 'total_score', category: 'semantic', weight: total, reason: 'Existing district relevance baseline' },
          ] as SignalContribution[],
          sourceExcerpts: sourceExcerpts.slice(0, 3),
          dampeners: confidence < confidenceThreshold
            ? [{ signal: 'low_confidence', impact: -0.2, reason: 'Insufficient matching depth across sources.' }]
            : [],
        },
        actions: {
          openDistrictSite: row.website_domain ? `https://${row.website_domain}` : null,
          email: row.superintendent_email,
          ncesId: row.nces_id,
        },
      }
    })
    .filter((row) => row.why.confidence >= Math.max(0.2, confidenceThreshold - 0.25))
    .sort((a, b) => b.score.composite - a.score.composite)
    .slice(0, requestedLimit)
    .map((row, index) => {
      // Precompute rich rationale for top 25, keep tail light and fetch on-demand.
      if (index < 25) return row
      return {
        ...row,
        why: {
          ...row.why,
          summary: 'Rationale available on demand. Click "Load full rationale".',
          sourceExcerpts: [],
        },
      }
    })

  const reasoningSteps = [
    `Intent classified as "${intent}".`,
    `Pre-filtered top-500 most relevant embedding chunks, then aggregated across ${rawRows.length} candidate districts.`,
    `Suppressed ${suppressedSet.size} previously engaged districts in last ${suppressionDays} days.`,
    `Candidates after suppression: ${afterSuppression.length}.`,
    `After state and score criteria: ${afterScoreThresholds.length}.`,
    `After grant criteria: ${afterGrantCriteria.length}.`,
    `After confidence threshold: ${districtsOut.length}.`,
  ]

  console.info('[command-search]', {
    prompt,
    intent,
    requestedLimit,
    scanMode: 'topK_prefilter_500_chunks',
    confidenceThreshold,
    suppressionDays,
    suppressedCount: suppressedSet.size,
    rawRows: rawRows.length,
    withIds: withIds.length,
    afterSuppression: afterSuppression.length,
    afterState: afterState.length,
    afterScoreThresholds: afterScoreThresholds.length,
    afterGrantCriteria: afterGrantCriteria.length,
    finalResults: districtsOut.length,
  })

  if (intent === 'insights_briefing') {
    const stateRows = await db.execute(sql`
      SELECT d.state, COUNT(*)::int as districts, AVG(s.total_score)::decimal as avg_score
      FROM districts d
      LEFT JOIN district_keyword_scores s ON d.nces_id = s.nces_id
      WHERE d.nces_id IS NOT NULL
      GROUP BY d.state
      ORDER BY avg_score DESC NULLS LAST
      LIMIT 3
    `)
    const topStates = (stateRows as any[])
      .map((row) => `${row.state} (avg score ${toNumber(row.avg_score).toFixed(2)})`)
      .join(', ')
    const briefingSummary = topStates
      ? `Top momentum states right now: ${topStates}.`
      : 'No state momentum signal is available yet.'
    districtsOut = districtsOut.slice(0, 10)
    return {
      intent,
      confidenceThreshold,
      explanation: `Weekly proactive briefing: ${briefingSummary}`,
      reasoning: {
      summary: 'Ranked by semantic similarity to query (top-500 chunks), with keyword scores as a secondary boost.',
      steps: reasoningSteps,
    },
    grantCriteria: parsedGrantCriteria,
    districts: districtsOut,
    generatedAt: new Date().toISOString(),
  }
}

  const explanation =
    intent === 'next_hottest_uncontacted'
      ? 'Prioritized uncontacted districts using score and suppression logic.'
      : intent === 'grant_match'
        ? 'Matched districts against extracted and explicit grant criteria with confidence scoring.'
        : 'Ranked districts by semantic relevance to your query, boosted by keyword scoring and evidence.'

  return {
    intent,
    confidenceThreshold,
    explanation,
    reasoning: {
      summary: 'Ranked by semantic similarity to query (top-500 chunks), with keyword scores as a secondary boost.',
      steps: reasoningSteps,
    },
    grantCriteria: parsedGrantCriteria,
    districts: districtsOut,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Compute an explainability payload for a single district.
 * Used by on-demand "why this district" panel expansion.
 */
export async function getDistrictWhyDetails(
  ncesId: string,
  confidenceThreshold: number = 0.6
) {
  const db = getDb()
  const rows = await db.execute(sql`
    SELECT
      d.nces_id,
      COALESCE(nr.district_name, d.name) AS name,
      s.readiness_score,
      s.alignment_score,
      s.activation_score,
      s.branding_score,
      s.total_score,
      s.keyword_matches
    FROM districts d
    LEFT JOIN national_registry nr ON nr.nces_id = d.nces_id
    LEFT JOIN district_keyword_scores s ON d.nces_id = s.nces_id
    WHERE d.nces_id = ${ncesId}
    LIMIT 1
  `)

  const row: any = rows[0]
  if (!row) {
    throw new Error('District not found')
  }

  const readiness = toNumber(row.readiness_score)
  const alignment = toNumber(row.alignment_score)
  const activation = toNumber(row.activation_score)
  const branding = toNumber(row.branding_score)
  const total = toNumber(row.total_score)
  const hasScores = total > 0 || readiness > 0 || alignment > 0 || activation > 0 || branding > 0
  const confidence = hasScores ? Math.min(0.95, Math.max(0.2, total / 10)) : 0.2
  const confidenceBand = toConfidenceBand(confidence)

  const sourceExcerpts: Array<{ documentUrl?: string | null; keyword: string; excerpt: string }> = []
  const keywordMatches = (row.keyword_matches || {}) as Record<string, any[]>
  for (const matches of Object.values(keywordMatches)) {
    for (const match of Array.isArray(matches) ? matches.slice(0, 2) : []) {
      sourceExcerpts.push({
        documentUrl: match.source_doc || null,
        keyword: match.keyword || 'signal',
        excerpt: match.context || 'Matched district signal.',
      })
    }
  }

  const summary = hasScores
    ? generateWhySummary(
        row.name,
        { readiness, alignment, activation, branding },
        0, // No semantic context in on-demand endpoint
        sourceExcerpts,
      )
    : `${row.name} has limited scoring data available. Keyword analysis may not have been completed for this district.`

  return {
    ncesId: row.nces_id,
    confidence,
    confidenceBand,
    summary,
    topSignals: [
      { signal: 'readiness_score', category: 'readiness', weight: readiness },
      { signal: 'alignment_score', category: 'alignment', weight: alignment },
      { signal: 'activation_score', category: 'activation', weight: activation },
      { signal: 'branding_score', category: 'branding', weight: branding },
      { signal: 'total_score', category: 'semantic', weight: total },
    ] as SignalContribution[],
    sourceExcerpts: sourceExcerpts.slice(0, 5),
    dampeners:
      confidence < confidenceThreshold
        ? [{ signal: 'low_confidence', impact: -0.2, reason: 'Insufficient supporting depth.' }]
        : [],
  }
}
