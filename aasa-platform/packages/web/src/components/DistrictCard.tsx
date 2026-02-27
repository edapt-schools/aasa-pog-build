import { Card } from './ui/card'
import { MapPin, Users, GraduationCap, Globe, Mail, User } from 'lucide-react'
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
      className={`bg-card rounded-lg border border-border transition-all duration-[var(--motion-fast)] ${
        onSelect ? 'cursor-pointer hover:shadow-md hover:border-accent/40' : ''
      }`}
      onClick={onSelect}
    >
      <div className="p-4 space-y-3">
        {/* Header: Name + tier badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate leading-snug">
              {district.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {district.city}, {district.state}
            </p>
          </div>
          {tier && (
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                tier === 'tier1'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : tier === 'tier2'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  tier === 'tier1'
                    ? 'bg-green-500'
                    : tier === 'tier2'
                      ? 'bg-amber-500'
                      : 'bg-gray-400'
                }`}
              />
              {tier === 'tier1' ? 'Tier 1' : tier === 'tier2' ? 'Tier 2' : 'Tier 3'}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {district.enrollment && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              {district.enrollment.toLocaleString()}
            </span>
          )}
          {district.gradesServed && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              {district.gradesServed}
            </span>
          )}
          {district.frplPercent && (
            <span className="text-xs text-muted-foreground">
              FRPL {parseFloat(district.frplPercent).toFixed(0)}%
            </span>
          )}
          {district.minorityPercent && (
            <span className="text-xs text-muted-foreground">
              Min {parseFloat(district.minorityPercent).toFixed(0)}%
            </span>
          )}
        </div>

        {/* Superintendent */}
        {district.superintendentName && (
          <div className="pt-2 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">
                {district.superintendentName}
              </span>
            </div>
            {district.superintendentEmail && (
              <a
                href={`mailto:${district.superintendentEmail}`}
                className="text-xs text-accent hover:underline flex items-center gap-1.5 pl-[18px]"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{district.superintendentEmail}</span>
              </a>
            )}
          </div>
        )}

        {/* Website */}
        {district.websiteDomain && (
          <a
            href={`https://${district.websiteDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Globe className="w-3 h-3 shrink-0" />
            <span className="truncate">{district.websiteDomain}</span>
          </a>
        )}
      </div>
    </Card>
  )
}
