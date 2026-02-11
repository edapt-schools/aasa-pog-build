import { sql, eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { generateEmbedding } from './embeddings.js'
import { districtKeywordScores, districts } from '../db/schema.js'
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
  const candidateScanLimit = Math.max(requestedLimit * 20, 500)

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

  const rows = await db.execute(sql`
    SELECT
      d.nces_id,
      d.name,
      d.state,
      d.city,
      d.enrollment,
      d.website_domain,
      d.superintendent_name,
      d.superintendent_email,
      d.frpl_percent,
      d.minority_percent,
      s.readiness_score,
      s.alignment_score,
      s.activation_score,
      s.branding_score,
      s.total_score,
      s.keyword_matches
    FROM districts d
    LEFT JOIN district_keyword_scores s ON d.nces_id = s.nces_id
    WHERE d.nces_id IS NOT NULL
    ORDER BY s.total_score DESC NULLS LAST
    LIMIT ${candidateScanLimit}
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
      const engagementPenalty = suppressedSet.has(row.nces_id) ? 2 : 0
      const eligibilityBoost =
        (parsedGrantCriteria?.frplMin && toNumber(row.frpl_percent) >= parsedGrantCriteria.frplMin ? 0.5 : 0) +
        (parsedGrantCriteria?.minorityMin && toNumber(row.minority_percent) >= parsedGrantCriteria.minorityMin ? 0.5 : 0)
      const composite = Math.max(0, total + eligibilityBoost - engagementPenalty)
      const confidence = Math.min(0.95, Math.max(0.2, composite / 10))
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
          phone: null,
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
          summary: `Top match due to scoring and evidence signals in district documents.`,
          topSignals: [
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
    `Scanned ${rawRows.length} candidate districts (requested ${requestedLimit}, scan window ${candidateScanLimit}).`,
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
    candidateScanLimit,
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
        summary: 'Generated from keyword-score ranking plus engagement suppression and confidence gating.',
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
        : 'Returned district matches based on existing district scoring and evidence.'

  return {
    intent,
    confidenceThreshold,
    explanation,
    reasoning: {
      summary: 'Generated from keyword-score ranking plus engagement suppression and confidence gating.',
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
      d.name,
      s.readiness_score,
      s.alignment_score,
      s.activation_score,
      s.branding_score,
      s.total_score,
      s.keyword_matches
    FROM districts d
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
  const confidence = Math.min(0.95, Math.max(0.2, total / 10))
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

  return {
    ncesId: row.nces_id,
    confidence,
    confidenceBand,
    summary:
      confidence >= confidenceThreshold
        ? `${row.name} has strong alignment to current query signals.`
        : `${row.name} has partial alignment and should be manually reviewed.`,
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
