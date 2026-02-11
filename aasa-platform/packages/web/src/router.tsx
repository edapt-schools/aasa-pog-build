import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AppLayout } from './components/layout/AppLayout'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Discovery from './pages/Discovery'
import Grants from './pages/Grants'
import Insights from './pages/Insights'
import CommandCenter from './pages/CommandCenter'

/**
 * Protected Route Component
 * Redirects to login if not authenticated
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  // Allow localhost access without auth for local UI development
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

  if (loading) {
    // On localhost, don't block on auth loading — show the UI immediately
    if (isLocalDev) return <>{children}</>

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
      </div>
    )
  }

  if (!user && !isLocalDev) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/command" replace />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallback />,
  },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/command',
        element: <CommandCenter />,
      },
      {
        path: '/discovery',
        element: <Discovery />,
      },
      {
        path: '/grants',
        element: <Grants />,
      },
      {
        path: '/insights',
        element: <Insights />,
      },
    ],
  },
  {
    path: '*',
    element: (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-heading-1 font-semibold text-foreground mb-2">
            404
          </h1>
          <p className="text-muted-foreground mb-4">Page not found</p>
          <a href="/" className="text-accent underline">
            Go home
          </a>
        </div>
      </div>
    ),
  },
])
