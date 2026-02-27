import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import * as eventUploadService from '../services/event-upload.js'
import * as eventQueries from '../db/queries/events.js'

const router = Router()

// All event routes require authentication
router.use(requireAuth)

/**
 * POST /api/events/upload
 * Upload a CSV of event attendees, parse it, match districts, and return results.
 *
 * Accepts either:
 *   - JSON body with { fileName, csvText } (base64 or raw text)
 *   - Raw text/csv body with X-File-Name header
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    let fileName: string
    let csvText: string

    // Support JSON body with csvText field
    if (req.body?.csvText) {
      fileName = req.body.fileName || 'upload.csv'
      csvText = req.body.csvText
    } else {
      return res.status(400).json({
        error: 'Request must include a JSON body with "csvText" (string) and optional "fileName".',
      })
    }

    if (!csvText || typeof csvText !== 'string' || csvText.trim().length === 0) {
      return res.status(400).json({ error: 'csvText is required and must not be empty' })
    }

    const result = await eventUploadService.processUpload(userId, fileName, csvText)
    res.status(201).json(result)
  } catch (error: any) {
    // Surface parsing/validation errors as 400
    if (
      error.message?.includes('CSV must contain') ||
      error.message?.includes('Could not detect')
    ) {
      return res.status(400).json({ error: error.message })
    }

    console.error('Event upload error:', error)
    res.status(500).json({ error: 'Failed to process upload' })
  }
})

/**
 * GET /api/events
 * List all previous uploads for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const uploads = await eventQueries.listUploads(userId)
    res.json({ uploads })
  } catch (error) {
    console.error('List events error:', error)
    res.status(500).json({ error: 'Failed to list uploads' })
  }
})

/**
 * GET /api/events/:id
 * Get upload details with matched results
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const data = await eventQueries.getUploadWithResults(
      req.params.id as string,
      userId
    )

    if (!data) {
      return res.status(404).json({ error: 'Upload not found' })
    }

    res.json(data)
  } catch (error) {
    console.error('Get event error:', error)
    res.status(500).json({ error: 'Failed to get upload results' })
  }
})

/**
 * GET /api/events/:id/export
 * Download results as CSV
 */
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || req.userEmail || ''
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const data = await eventQueries.getUploadWithResults(
      req.params.id as string,
      userId
    )

    if (!data) {
      return res.status(404).json({ error: 'Upload not found' })
    }

    const csv = eventUploadService.generateResultsCSV(data.results)

    const timestamp = new Date().toISOString().split('T')[0]
    const exportFileName = `event-results_${timestamp}.csv`

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName}"`)
    res.send(csv)
  } catch (error) {
    console.error('Export event error:', error)
    res.status(500).json({ error: 'Failed to export results' })
  }
})

export default router
