import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import * as searchesService from '../services/searches.js'

const router = Router()

// All saved search routes require authentication
router.use(requireAuth)

/**
 * GET /api/searches
 * List all saved searches for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const result = await searchesService.listSearches(userId)
    res.json(result)
  } catch (error: any) {
    console.error('List saved searches error:', error)
    res.status(500).json({ error: 'Failed to list saved searches' })
  }
})

/**
 * POST /api/searches
 * Save a search
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const { name, query, intent, filters, resultCount } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Search name is required' })
    }
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Search query is required' })
    }
    const search = await searchesService.createSearch(userId, {
      name: name.trim(),
      query: query.trim(),
      intent,
      filters,
      resultCount,
    })
    res.status(201).json(search)
  } catch (error: any) {
    console.error('Save search error:', error)
    res.status(500).json({ error: 'Failed to save search' })
  }
})

/**
 * DELETE /api/searches/:id
 * Delete a saved search
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    await searchesService.deleteSearch(req.params.id as string, userId)
    res.json({ success: true })
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Search not found' })
    }
    console.error('Delete search error:', error)
    res.status(500).json({ error: 'Failed to delete search' })
  }
})

export default router
