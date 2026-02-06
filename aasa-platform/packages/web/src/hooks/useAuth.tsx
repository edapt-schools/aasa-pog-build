import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'

interface User {
  userId: string
  email: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (provider?: 'google' | 'azure') => void
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check authentication status
  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        // Store session in backend
        await fetch(`${API_URL}/api/auth/session`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user.id,
            email: session.user.email,
          }),
        })

        setUser({
          userId: session.user.id,
          email: session.user.email || '',
        })
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  // Login - use Supabase client-side OAuth
  const login = async (provider: 'google' | 'azure' = 'google') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as 'google' | 'azure',
        options: {
          redirectTo: `${window.location.origin}/discovery`,
        },
      })

      if (error) throw error
    } catch (error) {
      console.error('Login error:', error)
    }
  }

  // Logout
  const logout = async () => {
    try {
      await supabase.auth.signOut()
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
      setUser(null)
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
