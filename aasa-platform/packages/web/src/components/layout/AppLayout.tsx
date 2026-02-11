import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/button'
import {
  Home,
  Search,
  BarChart3,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/command', label: 'Home', icon: Home },
  { path: '/discovery', label: 'Pipeline', icon: Search },
  { path: '/insights', label: 'Command Center', icon: BarChart3 },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Single unified header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          {/* Left: Brand */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Edapt symbol - cornflower blue arrow on navy */}
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 5l7 7-7 7" />
                <path d="M6 5l7 7-7 7" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-semibold text-foreground tracking-tight">AASA</span>
              <span className="text-sm text-muted-foreground ml-1 hidden md:inline">District Intelligence</span>
            </div>
          </div>

          {/* Center: Navigation pills */}
          <nav className="hidden md:flex items-center gap-1 bg-muted/50 rounded-lg p-1" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-[var(--motion-fast)] min-h-[36px] ${
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right: User menu */}
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden lg:block text-xs text-muted-foreground">
                {user.email}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground min-h-[36px]">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-1.5">Sign out</span>
            </Button>
            {/* Mobile menu toggle */}
            <button
              type="button"
              className="md:hidden p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-border bg-card px-4 py-2 space-y-1" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Main content - full width, no sidebar */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
