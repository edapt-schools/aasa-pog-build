import { useState, useMemo, useEffect } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import {
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Building2,
  MapPin,
  Users,
  Percent,
  Signal,
} from 'lucide-react'
import type { ListDistrictsParams } from '@aasa-platform/shared'

interface FilterPanelProps {
  filters: ListDistrictsParams
  onFilterChange: (filters: ListDistrictsParams) => void
  onReset: () => void
}

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

const LOCALE_TYPES = [
  { value: 'city', label: 'City' },
  { value: 'suburb', label: 'Suburb' },
  { value: 'town', label: 'Town' },
  { value: 'rural', label: 'Rural' },
]

export function FilterPanel({ filters, onFilterChange, onReset }: FilterPanelProps) {
  const [stateSearch, setStateSearch] = useState('')
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(filters.search || '')

  // Sync draft when search is cleared externally (Reset button, chip removal)
  useEffect(() => {
    if (!filters.search && searchDraft) {
      setSearchDraft('')
    }
  }, [filters.search]) // eslint-disable-line react-hooks/exhaustive-deps

  const commitSearch = () => {
    const trimmed = searchDraft.trim()
    if (trimmed !== (filters.search || '')) {
      onFilterChange({ ...filters, search: trimmed || undefined })
    }
  }

  const activeFilterCount = [
    filters.state?.length,
    filters.enrollmentMin || filters.enrollmentMax,
    filters.outreachTier?.length,
    filters.hasSuperintendent !== undefined,
    filters.frplMin || filters.frplMax,
    filters.minorityMin || filters.minorityMax,
    filters.localeType?.length,
    filters.search,
  ].filter(Boolean).length

  const hasActiveFilters = activeFilterCount > 0

  const filteredStates = useMemo(() => {
    if (!stateSearch) return Object.entries(US_STATES)
    const q = stateSearch.toLowerCase()
    return Object.entries(US_STATES).filter(
      ([code, name]) => code.toLowerCase().includes(q) || name.toLowerCase().includes(q)
    )
  }, [stateSearch])

  const toggleState = (stateCode: string) => {
    const currentStates = filters.state || []
    const newStates = currentStates.includes(stateCode)
      ? currentStates.filter((s) => s !== stateCode)
      : [...currentStates, stateCode]
    onFilterChange({ ...filters, state: newStates.length > 0 ? newStates : undefined })
  }

  const toggleLocale = (locale: string) => {
    const current = filters.localeType || []
    const next = current.includes(locale)
      ? current.filter((l) => l !== locale)
      : [...current, locale]
    onFilterChange({ ...filters, localeType: next.length > 0 ? next : undefined })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset}>Reset</Button>
        )}
      </div>

      <div className="space-y-6">
        {/* ── Search ──────────────────────────────────────── */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" /> Search
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="District or superintendent..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitSearch()
                }
              }}
              className="flex-1"
            />
            <Button
              variant="default"
              size="icon"
              className="shrink-0 h-9 w-9"
              onClick={commitSearch}
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── State (searchable dropdown) ──────────────────── */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" /> State
            {filters.state && filters.state.length > 0 && (
              <span className="text-xs text-muted-foreground">({filters.state.length})</span>
            )}
          </label>
          <button
            type="button"
            onClick={() => setStateDropdownOpen(!stateDropdownOpen)}
            className="w-full flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
          >
            <span className={filters.state?.length ? 'text-foreground' : 'text-muted-foreground'}>
              {filters.state?.length
                ? filters.state.length <= 3
                  ? filters.state.join(', ')
                  : `${filters.state.slice(0, 3).join(', ')} +${filters.state.length - 3}`
                : 'All states'}
            </span>
            {stateDropdownOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {stateDropdownOpen && (
            <div className="mt-1.5 border border-border rounded-lg bg-background shadow-lg overflow-hidden">
              <div className="p-2">
                <Input
                  type="text"
                  placeholder="Search states..."
                  value={stateSearch}
                  onChange={(e) => setStateSearch(e.target.value)}
                  className="text-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-52 overflow-y-auto px-1 pb-1">
                {filteredStates.map(([code, name]) => {
                  const isSelected = filters.state?.includes(code) || false
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleState(code)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-left transition-colors ${
                        isSelected
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="w-7 text-xs text-muted-foreground font-mono">{code}</span>
                      <span className="flex-1">{name}</span>
                      {isSelected && <span className="text-accent text-xs">✓</span>}
                    </button>
                  )
                })}
              </div>
              {filters.state && filters.state.length > 0 && (
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      onFilterChange({ ...filters, state: undefined })
                      setStateSearch('')
                    }}
                  >
                    Clear states
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Outreach Tier ────────────────────────────────── */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Signal className="w-4 h-4 text-muted-foreground" /> Outreach Tier
          </label>
          <div className="flex gap-2">
            {(['tier1', 'tier2', 'tier3'] as const).map((tier) => {
              const isSelected = filters.outreachTier?.includes(tier) || false
              const labels: Record<string, string> = { tier1: 'Tier 1 — Hot', tier2: 'Tier 2', tier3: 'Tier 3' }
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    const current = filters.outreachTier || []
                    const next = isSelected
                      ? current.filter((t) => t !== tier)
                      : [...current, tier]
                    onFilterChange({ ...filters, outreachTier: next.length > 0 ? next : undefined })
                  }}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {labels[tier]}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Enrollment Range ─────────────────────────────── */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> Enrollment
          </label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              placeholder="Min"
              value={filters.enrollmentMin ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  enrollmentMin: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              className="text-sm"
            />
            <span className="text-muted-foreground text-sm shrink-0">to</span>
            <Input
              type="number"
              placeholder="Max"
              value={filters.enrollmentMax ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  enrollmentMax: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              className="text-sm"
            />
          </div>
        </div>

        {/* ── Demographics ─────────────────────────────────── */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Demographics
          </h4>

          {/* FRPL % */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Percent className="w-4 h-4 text-muted-foreground" /> Free/Reduced Lunch
            </label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="Min %"
                min={0}
                max={100}
                value={filters.frplMin ?? ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    frplMin: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="text-sm"
              />
              <span className="text-muted-foreground text-sm shrink-0">to</span>
              <Input
                type="number"
                placeholder="Max %"
                min={0}
                max={100}
                value={filters.frplMax ?? ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    frplMax: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="text-sm"
              />
            </div>
          </div>

          {/* Minority % */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Percent className="w-4 h-4 text-muted-foreground" /> Minority Enrollment
            </label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="Min %"
                min={0}
                max={100}
                value={filters.minorityMin ?? ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    minorityMin: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="text-sm"
              />
              <span className="text-muted-foreground text-sm shrink-0">to</span>
              <Input
                type="number"
                placeholder="Max %"
                min={0}
                max={100}
                value={filters.minorityMax ?? ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    minorityMax: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="text-sm"
              />
            </div>
          </div>

          {/* Locale Type */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" /> Locale
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LOCALE_TYPES.map(({ value, label }) => {
                const isSelected = filters.localeType?.includes(value) || false
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleLocale(value)}
                    className={`flex items-center justify-center px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-accent/10 border-accent/30 text-accent'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Superintendent filter ────────────────────────── */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Superintendent Data
          </label>
          <div className="flex gap-2">
            <Button
              variant={filters.hasSuperintendent === true ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-9"
              onClick={() =>
                onFilterChange({
                  ...filters,
                  hasSuperintendent: filters.hasSuperintendent === true ? undefined : true,
                })
              }
            >
              Has Contact
            </Button>
            <Button
              variant={filters.hasSuperintendent === false ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-9"
              onClick={() =>
                onFilterChange({
                  ...filters,
                  hasSuperintendent: filters.hasSuperintendent === false ? undefined : false,
                })
              }
            >
              Missing Contact
            </Button>
          </div>
        </div>

        {/* ── Active Filters Chips ─────────────────────────── */}
        {hasActiveFilters && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Active Filters
            </label>
            <div className="flex flex-wrap gap-2">
              {filters.search && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/10 hover:text-destructive text-xs py-1"
                  onClick={() => onFilterChange({ ...filters, search: undefined })}
                >
                  &ldquo;{filters.search}&rdquo; <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
              {filters.state?.map((state) => (
                <Badge
                  key={state}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/10 hover:text-destructive text-xs py-1"
                  onClick={() => {
                    const next = (filters.state || []).filter((s) => s !== state)
                    onFilterChange({ ...filters, state: next.length > 0 ? next : undefined })
                  }}
                >
                  {state} <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
              {filters.outreachTier?.map((tier) => (
                <Badge
                  key={tier}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/10 hover:text-destructive text-xs py-1"
                  onClick={() => {
                    const next = (filters.outreachTier || []).filter((t) => t !== tier)
                    onFilterChange({ ...filters, outreachTier: next.length > 0 ? next : undefined })
                  }}
                >
                  {tier.toUpperCase()} <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
              {(filters.enrollmentMin || filters.enrollmentMax) && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/10 hover:text-destructive text-xs py-1"
                  onClick={() =>
                    onFilterChange({ ...filters, enrollmentMin: undefined, enrollmentMax: undefined })
                  }
                >
                  Enrollment <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
              {(filters.frplMin || filters.frplMax) && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/10 hover:text-destructive text-xs py-1"
                  onClick={() =>
                    onFilterChange({ ...filters, frplMin: undefined, frplMax: undefined })
                  }
                >
                  FRPL {filters.frplMin ? `≥${filters.frplMin}%` : ''}{filters.frplMax ? ` ≤${filters.frplMax}%` : ''} <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
              {(filters.minorityMin || filters.minorityMax) && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/10 hover:text-destructive text-xs py-1"
                  onClick={() =>
                    onFilterChange({ ...filters, minorityMin: undefined, minorityMax: undefined })
                  }
                >
                  Minority {filters.minorityMin ? `≥${filters.minorityMin}%` : ''}{filters.minorityMax ? ` ≤${filters.minorityMax}%` : ''} <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
              {filters.localeType?.map((locale) => (
                <Badge
                  key={locale}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/10 hover:text-destructive text-xs py-1"
                  onClick={() => {
                    const next = (filters.localeType || []).filter((l) => l !== locale)
                    onFilterChange({ ...filters, localeType: next.length > 0 ? next : undefined })
                  }}
                >
                  {locale.charAt(0).toUpperCase() + locale.slice(1)} <X className="ml-1 h-3 w-3" />
                </Badge>
              ))}
              {filters.hasSuperintendent !== undefined && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive/10 hover:text-destructive text-xs py-1"
                  onClick={() => onFilterChange({ ...filters, hasSuperintendent: undefined })}
                >
                  {filters.hasSuperintendent ? 'Has Supt' : 'No Supt'} <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
