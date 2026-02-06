import type { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

/**
 * Authentication middleware
 * Checks if user is authenticated via session OR Bearer token
 * Attaches userId to request object if authenticated
 */

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string
    userEmail?: string
  }
}

// Lazy-initialize Supabase client for token verification
let supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return supabase
}

/**
 * Require authentication for a route
 * Supports both cookie sessions and Bearer tokens
 * Returns 401 if no valid auth found
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // First, try cookie-based session
  if (req.session?.userId) {
    req.userId = req.session.userId
    req.userEmail = req.session.userEmail
    next()
    return
  }

  // Second, try Bearer token (Supabase JWT)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const { data: { user }, error } = await getSupabase().auth.getUser(token)
      if (error || !user) {
        res.status(401).json({ error: 'Invalid token' })
        return
      }
      req.userId = user.id
      req.userEmail = user.email
      next()
      return
    } catch (err) {
      console.error('Token verification error:', err)
      res.status(401).json({ error: 'Token verification failed' })
      return
    }
  }

  res.status(401).json({ error: 'Unauthorized' })
}

/**
 * Optional authentication
 * Attaches user info if session or token exists, but doesn't block request
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  // Try cookie-based session first
  if (req.session?.userId) {
    req.userId = req.session.userId
    req.userEmail = req.session.userEmail
    next()
    return
  }

  // Try Bearer token
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const { data: { user } } = await getSupabase().auth.getUser(token)
      if (user) {
        req.userId = user.id
        req.userEmail = user.email
      }
    } catch {
      // Silently ignore token errors for optional auth
    }
  }

  next()
}
