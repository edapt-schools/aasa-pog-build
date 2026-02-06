import { Card, CardHeader, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import type { District } from '@aasa-platform/shared'

interface DistrictCardProps {
  district: District
  onSelect?: () => void
  showScores?: boolean
  tier?: string
}

export function DistrictCard({ district, onSelect, tier }: DistrictCardProps) {
  return (
    <Card
      className={`bg-card rounded-lg border border-border transition-all ${
        onSelect ? 'cursor-pointer hover:shadow-md hover:border-accent' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {district.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {district.city}, {district.state} • NCES: {district.ncesId}
            </p>
          </div>
          {tier && (
            <Badge
              variant={
                tier === 'tier1'
                  ? 'default'
                  : tier === 'tier2'
                    ? 'secondary'
                    : 'outline'
              }
            >
              {tier.toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Enrollment */}
        {district.enrollment && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Enrollment</span>
            <span className="font-medium text-foreground">
              {district.enrollment.toLocaleString()}
            </span>
          </div>
        )}

        {/* Grades Served */}
        {district.gradesServed && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Grades</span>
            <span className="font-medium text-foreground">{district.gradesServed}</span>
          </div>
        )}

        {/* Superintendent */}
        {district.superintendentName && (
          <div className="pt-2 border-t border-border">
            <div className="text-sm text-muted-foreground mb-1">Superintendent</div>
            <div className="text-sm font-medium text-foreground">
              {district.superintendentName}
            </div>
            {district.superintendentEmail && (
              <a
                href={`mailto:${district.superintendentEmail}`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {district.superintendentEmail}
              </a>
            )}
          </div>
        )}

        {/* Demographics */}
        {(district.frplPercent || district.minorityPercent) && (
          <div className="pt-2 border-t border-border space-y-2">
            {district.frplPercent && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">FRPL %</span>
                <span className="font-medium text-foreground">
                  {parseFloat(district.frplPercent).toFixed(1)}%
                </span>
              </div>
            )}
            {district.minorityPercent && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Minority %</span>
                <span className="font-medium text-foreground">
                  {parseFloat(district.minorityPercent).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Website */}
        {district.websiteDomain && (
          <div className="pt-2 border-t border-border">
            <a
              href={`https://${district.websiteDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {district.websiteDomain}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
