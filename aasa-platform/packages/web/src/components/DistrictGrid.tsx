import { DistrictCard } from './DistrictCard'
import { EmptyState } from './EmptyState'
import { Card } from './ui/card'
import { AlertCircle, SearchX } from 'lucide-react'
import type { District } from '@aasa-platform/shared'

interface DistrictGridProps {
  districts: District[]
  loading: boolean
  error?: string | null
  total: number
  offset: number
  limit: number
  onDistrictClick: (district: District) => void
}

/**
 * Skeleton loading card matching DistrictCard structure
 */
function SkeletonCard() {
  return (
    <Card className="bg-card rounded-lg border border-border animate-pulse">
      <div className="border-b border-border p-4">
        <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-muted rounded w-1/2"></div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex justify-between">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/4"></div>
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/4"></div>
        </div>
        <div className="pt-2 border-t border-border">
          <div className="h-4 bg-muted rounded w-full mb-2"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
      </div>
    </Card>
  )
}

export function DistrictGrid({
  districts,
  loading,
  error,
  total,
  offset,
  limit,
  onDistrictClick,
}: DistrictGridProps) {
  // Calculate result range
  const startResult = total > 0 ? offset + 1 : 0
  const endResult = Math.min(offset + limit, total)

  // Show loading skeleton
  if (loading && districts.length === 0) {
    return (
      <div>
        <div className="text-sm text-muted-foreground mb-4">Loading districts...</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <EmptyState
        title="Error Loading Districts"
        description={error}
        icon={<AlertCircle className="w-10 h-10" />}
      />
    )
  }

  // Show empty state
  if (districts.length === 0) {
    return (
      <EmptyState
        title="No Districts Found"
        description="Try adjusting your filters to see more results."
        icon={<SearchX className="w-10 h-10" />}
      />
    )
  }

  return (
    <div>
      {/* Result count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {startResult.toLocaleString()}–{endResult.toLocaleString()} of{' '}
          {total.toLocaleString()} districts
        </p>
        {loading && (
          <span className="text-sm text-muted-foreground animate-pulse">Updating...</span>
        )}
      </div>

      {/* District grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {districts.map((district) => (
          <DistrictCard
            key={district.id}
            district={district}
            onSelect={() => onDistrictClick(district)}
          />
        ))}
      </div>
    </div>
  )
}
