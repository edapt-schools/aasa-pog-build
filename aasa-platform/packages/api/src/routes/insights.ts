import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import * as insightsQueries from '../db/queries/insights.js'

const router = Router()

// All insights routes require authentication
router.use(requireAuth)

/**
 * GET /api/insights/overview
 * Get national overview statistics
 *
 * Returns:
 * - totalDistricts: Total number of districts
 * - superintendentCoverage: { count, percent }
 * - documentStats: { totalDocuments }
 * - averageScores: { readiness, alignment, activation, branding, total }
 * - tierDistribution: { tier1, tier2, tier3 }
 * - lastUpdated: ISO timestamp
 */
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const result = await insightsQueries.getInsightsOverview()
    res.json(result)
  } catch (error) {
    console.error('Get insights overview error:', error)
    res.status(500).json({ error: 'Failed to get insights overview' })
  }
})

/**
 * GET /api/insights/states
 * Get aggregated statistics for all states (for map visualization)
 *
 * Returns array of states with:
 * - stateCode, stateName
 * - totalDistricts, superintendentCount, superintendentCoverage
 * - avgTotalScore
 * - tier1Count, tier2Count, tier3Count
 * - documentsCount
 */
router.get('/states', async (_req: Request, res: Response) => {
  try {
    const result = await insightsQueries.getAllStateStats()
    res.json(result)
  } catch (error) {
    console.error('Get state stats error:', error)
    res.status(500).json({ error: 'Failed to get state statistics' })
  }
})

/**
 * GET /api/insights/states/:stateCode
 * Get detailed statistics for a single state
 *
 * Returns:
 * - stateCode, stateName
 * - totalDistricts
 * - superintendentCoverage: { count, percent }
 * - scoreStats: { averageScores, tierDistribution }
 * - topDistricts: Array of top 10 districts by score
 * - documentsCount
 */
router.get('/states/:stateCode', async (req: Request, res: Response) => {
  try {
    const stateCode = (req.params.stateCode as string).toUpperCase()

    // Validate state code (2 letters)
    if (!/^[A-Z]{2}$/.test(stateCode)) {
      return res.status(400).json({ error: 'Invalid state code' })
    }

    const result = await insightsQueries.getStateDetail(stateCode)

    // Check if state has any data
    if (result.totalDistricts === 0) {
      return res.status(404).json({ error: 'State not found or has no data' })
    }

    res.json(result)
  } catch (error) {
    console.error('Get state detail error:', error)
    res.status(500).json({ error: 'Failed to get state details' })
  }
})

/**
 * GET /api/insights/trending
 * Get trending keywords with counts
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' (default: '30d')
 *
 * Returns:
 * - period: The requested period
 * - keywords: Array of { keyword, category, currentCount, changePercent, trend }
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '30d'

    // Validate period
    if (!['7d', '30d', '90d'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use 7d, 30d, or 90d' })
    }

    const result = await insightsQueries.getTrendingKeywords(period)
    res.json(result)
  } catch (error) {
    console.error('Get trending keywords error:', error)
    res.status(500).json({ error: 'Failed to get trending keywords' })
  }
})

export default router
