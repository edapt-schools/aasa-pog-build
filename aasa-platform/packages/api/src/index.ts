/**
 * AASA Platform API Server
 * Express backend for district intelligence platform
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load environment variables from workspace root
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '../../../.env') })

import express from 'express'
import cookieSession from 'cookie-session'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import districtRoutes from './routes/districts.js'
import searchRoutes from './routes/search.js'
import insightsRoutes from './routes/insights.js'

const app = express()
const PORT = process.env.PORT || 4000

// =============================================================================
// Middleware
// =============================================================================

// CORS - Allow frontend to make requests
app.use(
  cors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true, // Allow cookies
  })
)

// JSON body parser
app.use(express.json())

// Cookie-based sessions
app.use(
  cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'dev-secret-key-change-in-production'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
)

// =============================================================================
// Routes
// =============================================================================

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Auth routes
app.use('/api/auth', authRoutes)

// District routes
app.use('/api/districts', districtRoutes)

// Search routes
app.use('/api/search', searchRoutes)

// Insights routes
app.use('/api/insights', insightsRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
  console.log(`\n🚀 API Server running on http://localhost:${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`   Frontend URL: ${process.env.APP_URL}`)
  console.log(`   Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]}\n`)
})
