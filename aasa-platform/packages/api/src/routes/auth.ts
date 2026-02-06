import { Router } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const router = Router()

// Lazy-initialize Supabase client (after env vars are loaded)
let supabase: SupabaseClient | null = null
function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )
  }
  return supabase
}

/**
 * GET /api/auth/login?provider=google|azure
 * Initiate Supabase OAuth flow with specified provider
 */
router.get('/login', async (req, res) => {
  try {
    const provider = (req.query.provider as string) || 'google'

    // Validate provider
    if (!['google', 'azure'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider. Must be google or azure' })
    }

    const { data, error } = await getSupabase().auth.signInWithOAuth({
      provider: provider as 'google' | 'azure',
      options: {
        redirectTo: `${process.env.API_URL}/api/auth/callback`,
        ...(provider === 'google' && {
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }),
        ...(provider === 'azure' && {
          scopes: 'email profile',
        }),
      },
    })

    if (error) throw error

    // Redirect to OAuth provider
    res.redirect(data.url)
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Failed to initiate login' })
  }
})

/**
 * GET /api/auth/callback
 * Handle OAuth callback from Supabase
 */
router.get('/callback', async (req, res) => {
  try {
    // Log all query params for debugging
    console.log('OAuth callback received:', req.query)

    const code = req.query.code as string

    if (!code) {
      throw new Error('No authorization code provided')
    }

    // Exchange code for session
    const { data, error } = await getSupabase().auth.exchangeCodeForSession(code)

    if (error) throw error

    const user = data.user
    if (!user) {
      throw new Error('No user data returned')
    }

    // Store user info in session
    req.session!.userId = user.id
    req.session!.userEmail = user.email

    // Redirect to frontend
    res.redirect(`${process.env.APP_URL}/discovery`)
  } catch (error) {
    console.error('Callback error:', error)
    res.redirect(`${process.env.APP_URL}/login?error=auth_failed`)
  }
})

/**
 * POST /api/auth/session
 * Store user session from frontend
 */
router.post('/session', async (req, res) => {
  try {
    const { userId, email } = req.body

    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing userId or email' })
    }

    // Store in session
    req.session!.userId = userId
    req.session!.userEmail = email

    res.json({ success: true })
  } catch (error) {
    console.error('Session store error:', error)
    res.status(500).json({ error: 'Failed to store session' })
  }
})

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    res.json({
      userId: req.session.userId,
      email: req.session.userEmail,
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Failed to get user info' })
  }
})

/**
 * POST /api/auth/logout
 * Clear session and sign out
 */
router.post('/logout', async (req, res) => {
  try {
    // Clear session
    req.session = null

    res.json({ message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ error: 'Failed to logout' })
  }
})

export default router
