import { NavLink } from 'react-router-dom'
import { Badge } from '../ui/badge'

interface SidebarItem {
  path: string
  label: string
  icon: React.ReactNode
  disabled?: boolean
}

const sidebarItems: SidebarItem[] = [
  {
    path: '/discovery',
    label: 'Discovery Mode',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
  },
  {
    path: '/grants',
    label: 'Grants Mode',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    path: '/insights',
    label: 'Insights Mode',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    disabled: true,
  },
]

export function Sidebar() {
  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Modes
        </h2>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {sidebarItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                item.disabled
                  ? 'opacity-50 cursor-not-allowed pointer-events-none'
                  : isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`
            }
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.disabled && (
              <Badge variant="secondary" className="text-xs">
                Soon
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Phase 1: Foundation</p>
          <p>19,595 districts loaded</p>
          <p>12,086 document embeddings</p>
        </div>
      </div>
    </div>
  )
}
