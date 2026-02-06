import type { Request, Response, NextFunction } from 'express'

/**
 * Authentication middleware
 * Checks if user is authenticated via session
 * Attaches userId to request object if authenticated
 */

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string
    userEmail?: string
  }
}

/**
 * Require authentication for a route
 * Returns 401 if no session found
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Attach user info to request
  req.userId = req.session.userId
  req.userEmail = req.session.userEmail

  next()
}

/**
 * Optional authentication
 * Attaches user info if session exists, but doesn't block request
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.session?.userId) {
    req.userId = req.session.userId
    req.userEmail = req.session.userEmail
  }

  next()
}
