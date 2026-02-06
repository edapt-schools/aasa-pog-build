import { Card, CardHeader, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Checkbox } from './ui/checkbox'
import { X } from 'lucide-react'
import type { ListDistrictsParams } from '@aasa-platform/shared'

interface FilterPanelProps {
  filters: ListDistrictsParams
  onFilterChange: (filters: ListDistrictsParams) => void
  onReset: () => void
}

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
]

export function FilterPanel({ filters, onFilterChange, onReset }: FilterPanelProps) {
  // Count active filters
  const activeFilterCount = [
    filters.state?.length,
    filters.enrollmentMin || filters.enrollmentMax,
    filters.outreachTier?.length,
    filters.hasSuperintendent !== undefined,
    filters.readinessScoreMin,
    filters.alignmentScoreMin,
    filters.activationScoreMin,
    filters.brandingScoreMin,
  ].filter(Boolean).length

  const hasActiveFilters = activeFilterCount > 0

  // Helper to toggle state selection
  const toggleState = (stateCode: string) => {
    const currentStates = filters.state || []
    const newStates = currentStates.includes(stateCode)
      ? currentStates.filter((s) => s !== stateCode)
      : [...currentStates, stateCode]

    onFilterChange({
      ...filters,
      state: newStates.length > 0 ? newStates : undefined,
    })
  }

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">Filters</h3>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              Reset
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* State Filter - Multi-select */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            State {filters.state && filters.state.length > 0 && `(${filters.state.length})`}
          </label>
          <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-md p-2 bg-background">
            {US_STATES.map((state) => (
              <label
                key={state}
                className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer"
              >
                <Checkbox
                  checked={filters.state?.includes(state) || false}
                  onCheckedChange={() => toggleState(state)}
                />
                <span className="text-sm text-foreground">{state}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Enrollment Range */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Enrollment Range
          </label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.enrollmentMin || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  enrollmentMin: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
            />
            <Input
              type="number"
              placeholder="Max"
              value={filters.enrollmentMax || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  enrollmentMax: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>

        {/* Tier Filter - Multi-select */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Outreach Tier
          </label>
          <div className="flex gap-2">
            {['tier1', 'tier2', 'tier3'].map((tier) => {
              const isSelected = filters.outreachTier?.includes(tier) || false
              return (
                <Badge
                  key={tier}
                  variant={isSelected ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    const currentTiers = filters.outreachTier || []
                    const newTiers = isSelected
                      ? currentTiers.filter((t) => t !== tier)
                      : [...currentTiers, tier]
                    onFilterChange({
                      ...filters,
                      outreachTier: newTiers.length > 0 ? newTiers : undefined,
                    })
                  }}
                >
                  {tier.toUpperCase()}
                </Badge>
              )
            })}
          </div>
        </div>

        {/* Superintendent Filter */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Superintendent Data
          </label>
          <div className="flex gap-2">
            <Button
              variant={filters.hasSuperintendent === true ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                onFilterChange({
                  ...filters,
                  hasSuperintendent:
                    filters.hasSuperintendent === true ? undefined : true,
                })
              }
            >
              Has Contact
            </Button>
            <Button
              variant={filters.hasSuperintendent === false ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                onFilterChange({
                  ...filters,
                  hasSuperintendent:
                    filters.hasSuperintendent === false ? undefined : false,
                })
              }
            >
              Missing Contact
            </Button>
          </div>
        </div>

        {/* Keyword Score Filters */}
        <div className="border-t border-border pt-4 space-y-4">
          <h4 className="text-sm font-medium text-foreground">Keyword Scores (Min)</h4>

          {/* Readiness Score */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-muted-foreground">Readiness</label>
              <span className="text-sm font-medium text-foreground">
                {filters.readinessScoreMin || 0}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filters.readinessScoreMin || 0}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  readinessScoreMin: parseInt(e.target.value) || undefined,
                })
              }
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Alignment Score */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-muted-foreground">Alignment</label>
              <span className="text-sm font-medium text-foreground">
                {filters.alignmentScoreMin || 0}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filters.alignmentScoreMin || 0}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  alignmentScoreMin: parseInt(e.target.value) || undefined,
                })
              }
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>

          {/* Activation Score */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-muted-foreground">Activation</label>
              <span className="text-sm font-medium text-foreground">
                {filters.activationScoreMin || 0}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filters.activationScoreMin || 0}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  activationScoreMin: parseInt(e.target.value) || undefined,
                })
              }
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-cyan-600"
            />
          </div>

          {/* Branding Score */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-muted-foreground">Branding</label>
              <span className="text-sm font-medium text-foreground">
                {filters.brandingScoreMin || 0}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filters.brandingScoreMin || 0}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  brandingScoreMin: parseInt(e.target.value) || undefined,
                })
              }
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
          </div>
        </div>

        {/* Active Filters Chips */}
        {hasActiveFilters && (
          <div className="border-t border-border pt-4">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Active Filters
            </label>
            <div className="flex flex-wrap gap-2">
              {filters.state?.map((state) => (
                <Badge
                  key={state}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-white"
                  onClick={() => {
                    const newStates = (filters.state || []).filter((s) => s !== state)
                    onFilterChange({
                      ...filters,
                      state: newStates.length > 0 ? newStates : undefined,
                    })
                  }}
                >
                  {state}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
              {filters.outreachTier?.map((tier) => (
                <Badge
                  key={tier}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-white"
                  onClick={() => {
                    const newTiers = (filters.outreachTier || []).filter((t) => t !== tier)
                    onFilterChange({
                      ...filters,
                      outreachTier: newTiers.length > 0 ? newTiers : undefined,
                    })
                  }}
                >
                  {tier.toUpperCase()}
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
              {(filters.enrollmentMin || filters.enrollmentMax) && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-white"
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      enrollmentMin: undefined,
                      enrollmentMax: undefined,
                    })
                  }
                >
                  Enrollment
                  <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
