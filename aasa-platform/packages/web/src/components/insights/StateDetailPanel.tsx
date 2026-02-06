import { useEffect } from 'react'
import { X, Users, FileText, ExternalLink } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import { useStateDetail } from '../../hooks/useStateStats'

interface StateDetailPanelProps {
  stateCode: string
  onClose: () => void
}

/**
 * StateDetailPanel - Slide-in panel showing detailed state statistics
 * Shows superintendent coverage, score breakdown, tier distribution, and top districts
 */
export function StateDetailPanel({ stateCode, onClose }: StateDetailPanelProps) {
  const { data, loading, error } = useStateDetail(stateCode)

  // Handle ESC key to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const getTierBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'tier1':
        return 'default'
      case 'tier2':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-background border-l border-border overflow-y-auto shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${data?.stateName || stateCode}`}
      >
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background border-b border-border p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {loading ? 'Loading...' : data?.stateName || stateCode}
            </h2>
            {data && (
              <p className="text-sm text-muted-foreground">
                {data.totalDistricts.toLocaleString()} districts
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="h-5 w-5" />
          </Button>
        </header>

        {/* Content */}
        <div className="p-4 space-y-6">
          {loading && (
            <div className="space-y-4">
              <div className="h-24 bg-muted animate-pulse rounded-lg" />
              <div className="h-24 bg-muted animate-pulse rounded-lg" />
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {data && (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{data.superintendentCoverage.percent}%</p>
                        <p className="text-xs text-muted-foreground">Coverage</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{data.documentsCount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Documents</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Score Breakdown */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Average Scores</h3>
                <div className="space-y-3">
                  {(['readiness', 'alignment', 'activation', 'branding'] as const).map((category) => {
                    const score = data.scoreStats.averageScores[category]
                    const colors = {
                      readiness: 'bg-blue-500',
                      alignment: 'bg-green-500',
                      activation: 'bg-orange-500',
                      branding: 'bg-purple-500',
                    }

                    return (
                      <div key={category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize">{category}</span>
                          <span className="font-medium">{score.toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colors[category]} rounded-full transition-all`}
                            style={{ width: `${(score / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Tier Distribution */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Tier Distribution</h3>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-600">
                      {data.scoreStats.tierDistribution.tier1}
                    </p>
                    <p className="text-xs text-emerald-600/80">Tier 1</p>
                  </div>
                  <div className="flex-1 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-amber-600">
                      {data.scoreStats.tierDistribution.tier2}
                    </p>
                    <p className="text-xs text-amber-600/80">Tier 2</p>
                  </div>
                  <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-950/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-slate-600">
                      {data.scoreStats.tierDistribution.tier3}
                    </p>
                    <p className="text-xs text-slate-600/80">Tier 3</p>
                  </div>
                </div>
              </div>

              {/* Top Districts */}
              {data.topDistricts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Top Districts by Score</h3>
                  <div className="space-y-2">
                    {data.topDistricts.map((district, index) => (
                      <div
                        key={district.ncesId}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-muted-foreground w-5">
                            {index + 1}.
                          </span>
                          <div>
                            <p className="font-medium text-sm">{district.name}</p>
                            <p className="text-xs text-muted-foreground">{district.ncesId}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getTierBadgeVariant(district.tier)}>
                            {district.tier.toUpperCase()}
                          </Badge>
                          <span className="font-semibold text-sm">
                            {district.totalScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* View in Discovery */}
              <div className="pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    window.location.href = `/discovery?state=${stateCode}`
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All Districts in Discovery
                </Button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
