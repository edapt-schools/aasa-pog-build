import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/button'

export function TopBar() {
  const { user, logout } = useAuth()

  return (
    <div className="bg-card border-b border-border">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">
            AASA District Intelligence
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <>
              <div className="text-sm text-foreground">{user.email}</div>
              <Button variant="outline" size="sm" onClick={logout}>
                Sign Out
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
