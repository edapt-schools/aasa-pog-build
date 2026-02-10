import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import * as searchService from '../services/search.js'
import type { CommandRequest, SemanticSearchParams } from '@aasa-platform/shared'

const router = Router()

// All search routes require authentication
router.use(requireAuth)

/**
 * POST /api/search/semantic
 * Semantic search using OpenAI embeddings + pgvector
 *
 * Body:
 * {
 *   "query": "portrait of a graduate",
 *   "limit": 20,
 *   "state": "CA",
 *   "distanceThreshold": 0.5
 * }
 *
 * Returns:
 * {
 *   "results": [
 *     {
 *       "document": {...},
 *       "district": {...},
 *       "chunkText": "...",
 *       "distance": 0.23,
 *       "relevanceScore": 0.885
 *     }
 *   ],
 *   "query": "portrait of a graduate",
 *   "total": 15
 * }
 */
router.post('/semantic', async (req: Request, res: Response) => {
  try {
    const { query, limit, state, distanceThreshold, documentTypes, dateFrom, dateTo } = req.body

    // Validate required fields
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query parameter is required and must be a string',
      })
    }

    // Validate query length
    if (query.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query cannot be empty',
      })
    }

    if (query.length > 500) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query too long (max 500 characters)',
      })
    }

    // Build search params
    const params: SemanticSearchParams = {
      query: query.trim(),
      limit: limit ? Math.min(Number(limit), 100) : 20, // Max 100 results
      state: state || undefined,
      distanceThreshold: distanceThreshold || 0.5,
      documentTypes:
        Array.isArray(documentTypes) && documentTypes.length > 0
          ? documentTypes.map((t: unknown) => String(t))
          : undefined,
      dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
      dateTo: typeof dateTo === 'string' ? dateTo : undefined,
    }

    // Execute search
    const results = await searchService.semanticSearch(params)

    res.json(results)
  } catch (error: any) {
    console.error('Semantic search error:', error)

    // Handle specific error types
    if (error.message?.includes('OPENAI_API_KEY')) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Search service not configured',
      })
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to execute search',
    })
  }
})

/**
 * POST /api/search/command
 * Unified command endpoint for AI-first search and actions.
 */
router.post('/command', async (req: Request, res: Response) => {
  try {
    const body = req.body as CommandRequest
    if (!body?.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Prompt is required',
      })
    }

    const response = await searchService.runCommand({
      ...body,
      prompt: body.prompt.trim(),
      confidenceThreshold:
        body.confidenceThreshold !== undefined
          ? Math.min(0.95, Math.max(0.2, Number(body.confidenceThreshold)))
          : 0.6,
    })

    res.json(response)
  } catch (error) {
    console.error('Command search error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to execute command request',
    })
  }
})

/**
 * GET /api/search/similar/:documentId
 * Find similar documents using vector similarity
 *
 * Query params:
 * - limit: number (default: 20, max: 50)
 *
 * Returns:
 * {
 *   "results": [
 *     {
 *       "document": {...},
 *       "district": {...},
 *       "similarity": 0.92
 *     }
 *   ],
 *   "sourceDocumentId": "uuid",
 *   "total": 15
 * }
 */
router.get('/similar/:documentId', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId as string
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 20

    // Validate document ID (UUID format)
    if (!documentId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Valid document ID is required',
      })
    }

    // Execute search
    const results = await searchService.getSimilarDocuments(documentId, limit)

    res.json(results)
  } catch (error: any) {
    console.error('Similar documents error:', error)

    // Handle specific error types
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Document not found or has no embeddings',
      })
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to find similar documents',
    })
  }
})

/**
 * GET /api/search/evidence/:ncesId
 * Get keyword evidence for a district
 * Shows matched keywords, scores, and document excerpts for all 4 categories
 *
 * Returns:
 * {
 *   "ncesId": "0100005",
 *   "districtName": "Alabama City",
 *   "readiness": {
 *     "score": 7.5,
 *     "keywordsFound": ["portrait of graduate", "strategic plan"],
 *     "totalMentions": 47,
 *     "documents": [...]
 *   },
 *   "alignment": {...},
 *   "activation": {...},
 *   "branding": {...},
 *   "totalScore": 6.8,
 *   "scoredAt": "2026-02-01T..."
 * }
 */
router.get('/evidence/:ncesId', async (req: Request, res: Response) => {
  try {
    const ncesId = req.params.ncesId as string

    // Validate NCES ID format (7 digits)
    if (!ncesId || !/^\d{7}$/.test(ncesId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Valid NCES ID is required (7 digits)',
      })
    }

    // Get keyword evidence
    const results = await searchService.getKeywordEvidence(ncesId)

    res.json(results)
  } catch (error: any) {
    console.error('Keyword evidence error:', error)

    // Handle specific error types
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'District not found',
      })
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve keyword evidence',
    })
  }
})

/**
 * GET /api/search/why/:ncesId
 * On-demand district explainability payload.
 */
router.get('/why/:ncesId', async (req: Request, res: Response) => {
  try {
    const ncesId = req.params.ncesId as string
    const thresholdRaw = req.query.confidenceThreshold
    const confidenceThreshold =
      thresholdRaw !== undefined ? Math.min(0.95, Math.max(0.2, Number(thresholdRaw))) : 0.6

    if (!ncesId || !/^\\d{7}$/.test(ncesId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Valid NCES ID is required (7 digits)',
      })
    }

    const response = await searchService.getDistrictWhyDetails(ncesId, confidenceThreshold)
    res.json(response)
  } catch (error: any) {
    console.error('District why-details error:', error)
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'District not found',
      })
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve explainability payload',
    })
  }
})

/**
 * GET /api/search/health
 * Check if search service is configured and ready
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const hasOpenAIKey = process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== 'your-openai-key-here'

    res.json({
      status: hasOpenAIKey ? 'ready' : 'not_configured',
      message: hasOpenAIKey
        ? 'Search service is ready'
        : 'OPENAI_API_KEY not configured',
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to check search health' })
  }
})

export default router
