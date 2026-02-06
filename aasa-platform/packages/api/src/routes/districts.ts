import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import * as districtService from '../services/districts.js'
import type { ListDistrictsParams } from '@aasa-platform/shared'

const router = Router()

// All district routes require authentication
router.use(requireAuth)

/**
 * GET /api/districts
 * List districts with filters and pagination
 *
 * Query params:
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 * - state: string[] (e.g., ?state=CA&state=NY)
 * - enrollmentMin: number
 * - enrollmentMax: number
 * - outreachTier: string[] (tier1, tier2, tier3)
 * - hasSuperintendent: boolean
 * - search: string (name search)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const params: ListDistrictsParams = {
      limit: Math.min(Number(req.query.limit) || 50, 100),
      offset: Number(req.query.offset) || 0,
      state: req.query.state
        ? Array.isArray(req.query.state)
          ? (req.query.state as string[])
          : [req.query.state as string]
        : undefined,
      enrollmentMin: req.query.enrollmentMin
        ? Number(req.query.enrollmentMin)
        : undefined,
      enrollmentMax: req.query.enrollmentMax
        ? Number(req.query.enrollmentMax)
        : undefined,
      outreachTier: req.query.outreachTier
        ? Array.isArray(req.query.outreachTier)
          ? (req.query.outreachTier as string[])
          : [req.query.outreachTier as string]
        : undefined,
      hasSuperintendent:
        req.query.hasSuperintendent !== undefined
          ? req.query.hasSuperintendent === 'true'
          : undefined,
      search: req.query.search as string | undefined,
    }

    const result = await districtService.listDistricts(params)
    res.json(result)
  } catch (error) {
    console.error('List districts error:', error)
    res.status(500).json({ error: 'Failed to list districts' })
  }
})

/**
 * GET /api/districts/:ncesId
 * Get single district details with keyword scores
 */
router.get('/:ncesId', async (req: Request, res: Response) => {
  try {
    const ncesId = req.params.ncesId as string

    const result = await districtService.getDistrictByNcesId(ncesId)

    if (!result) {
      return res.status(404).json({ error: 'District not found' })
    }

    res.json(result)
  } catch (error) {
    console.error('Get district error:', error)
    res.status(500).json({ error: 'Failed to get district' })
  }
})

/**
 * GET /api/districts/:ncesId/documents
 * Get all documents for a district
 */
router.get('/:ncesId/documents', async (req: Request, res: Response) => {
  try {
    const ncesId = req.params.ncesId as string

    const result = await districtService.getDistrictDocuments(ncesId)
    res.json(result)
  } catch (error) {
    console.error('Get district documents error:', error)
    res.status(500).json({ error: 'Failed to get district documents' })
  }
})

export default router
