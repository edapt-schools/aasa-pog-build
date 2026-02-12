import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import * as cohortService from '../services/cohorts.js'

const router = Router()

// All cohort routes require authentication
router.use(requireAuth)

/**
 * GET /api/cohorts
 * List all cohorts for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const result = await cohortService.listCohorts(userId)
    res.json(result)
  } catch (error: any) {
    console.error('List cohorts error:', error)
    res.status(500).json({ error: 'Failed to list cohorts' })
  }
})

/**
 * POST /api/cohorts
 * Create a new named cohort
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const { name, description } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Cohort name is required' })
    }
    const cohort = await cohortService.createCohort(userId, name.trim(), description)
    res.status(201).json(cohort)
  } catch (error: any) {
    console.error('Create cohort error:', error)
    res.status(500).json({ error: 'Failed to create cohort' })
  }
})

/**
 * GET /api/cohorts/:id
 * Get cohort detail with district information
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const result = await cohortService.getCohortDetail(req.params.id as string, userId)
    res.json(result)
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Cohort not found' })
    }
    console.error('Get cohort error:', error)
    res.status(500).json({ error: 'Failed to get cohort' })
  }
})

/**
 * PUT /api/cohorts/:id
 * Update cohort name/description
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const { name, description } = req.body
    const result = await cohortService.updateCohort(req.params.id as string, userId, { name, description })
    res.json(result)
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Cohort not found' })
    }
    console.error('Update cohort error:', error)
    res.status(500).json({ error: 'Failed to update cohort' })
  }
})

/**
 * DELETE /api/cohorts/:id
 * Delete a cohort and all its items
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    await cohortService.deleteCohort(req.params.id as string, userId)
    res.json({ success: true })
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Cohort not found' })
    }
    console.error('Delete cohort error:', error)
    res.status(500).json({ error: 'Failed to delete cohort' })
  }
})

/**
 * POST /api/cohorts/:id/districts
 * Add one or more districts to a cohort
 */
router.post('/:id/districts', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const { ncesIds } = req.body
    if (!Array.isArray(ncesIds) || ncesIds.length === 0) {
      return res.status(400).json({ error: 'ncesIds array is required' })
    }
    const result = await cohortService.addDistrictsToCohort(req.params.id as string, userId, ncesIds)
    res.json(result)
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Cohort not found' })
    }
    console.error('Add districts to cohort error:', error)
    res.status(500).json({ error: 'Failed to add districts' })
  }
})

/**
 * DELETE /api/cohorts/:id/districts/:ncesId
 * Remove a district from a cohort
 */
router.delete('/:id/districts/:ncesId', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    await cohortService.removeDistrictFromCohort(req.params.id as string, userId, req.params.ncesId as string)
    res.json({ success: true })
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Cohort not found' })
    }
    console.error('Remove district from cohort error:', error)
    res.status(500).json({ error: 'Failed to remove district' })
  }
})

export default router
