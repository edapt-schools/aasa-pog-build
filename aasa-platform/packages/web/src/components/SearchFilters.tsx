import { useState } from 'react'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { X, FileText, Calendar, MapPin } from 'lucide-react'
import type { SearchFilters as SearchFiltersType } from '@aasa-platform/shared'

interface SearchFiltersProps {
  filters: SearchFiltersType
  onChange: (filters: SearchFiltersType) => void
}

// Common document types
const DOCUMENT_TYPES = [
  { value: 'strategic_plan', label: 'Strategic Plan' },
  { value: 'annual_report', label: 'Annual Report' },
  { value: 'board_policy', label: 'Board Policy' },
  { value: 'budget', label: 'Budget' },
  { value: 'curriculum', label: 'Curriculum' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'webpage', label: 'Webpage' },
  { value: 'other', label: 'Other' },
]

// US States (abbreviated)
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]

function FilterSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-5 border-b border-border/60 last:border-b-0 last:pb-0">
      {children}
    </div>
  )
}

function SectionLabel({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-accent/70" />
      {children}
    </Label>
  )
}

/**
 * Search filters component for Grants Mode
 * Allows filtering by document type, date range, and state
 */
export function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  const [localFilters, setLocalFilters] = useState<SearchFiltersType>(filters)

  // Handle document type toggle
  const handleDocumentTypeChange = (type: string, checked: boolean) => {
    const currentTypes = localFilters.documentType || []
    const newTypes = checked
      ? [...currentTypes, type]
      : currentTypes.filter((t) => t !== type)

    const newFilters = {
      ...localFilters,
      documentType: newTypes.length > 0 ? newTypes : undefined,
    }
    setLocalFilters(newFilters)
    onChange(newFilters)
  }

  // Handle date change
  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    const newFilters = {
      ...localFilters,
      [field]: value || undefined,
    }
    setLocalFilters(newFilters)
    onChange(newFilters)
  }

  // Handle state change
  const handleStateChange = (state: string) => {
    const newFilters = {
      ...localFilters,
      state: state || undefined,
    }
    setLocalFilters(newFilters)
    onChange(newFilters)
  }

  // Clear all filters
  const handleClearAll = () => {
    const emptyFilters: SearchFiltersType = {}
    setLocalFilters(emptyFilters)
    onChange(emptyFilters)
  }

  // Count active filters
  const activeFilterCount =
    (localFilters.documentType?.length || 0) +
    (localFilters.dateFrom ? 1 : 0) +
    (localFilters.dateTo ? 1 : 0) +
    (localFilters.state ? 1 : 0)

  return (
    <div className="bg-muted/30 rounded-xl p-5 border border-border/50 space-y-5">
      {/* Header with clear button */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <h3 className="text-base font-semibold text-foreground">
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </h3>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-xs h-7 text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Document Type Filter */}
      <FilterSection>
        <SectionLabel icon={FileText}>Document Type</SectionLabel>
        <div className="space-y-1.5 pl-0.5">
          {DOCUMENT_TYPES.map((type) => (
            <div key={type.value} className="flex items-center space-x-2.5 py-0.5">
              <Checkbox
                id={`type-${type.value}`}
                checked={localFilters.documentType?.includes(type.value) || false}
                onCheckedChange={(checked) =>
                  handleDocumentTypeChange(type.value, checked === true)
                }
              />
              <label
                htmlFor={`type-${type.value}`}
                className="text-sm cursor-pointer text-foreground/80 hover:text-foreground transition-colors"
              >
                {type.label}
              </label>
            </div>
          ))}
        </div>
      </FilterSection>

      {/* Date Range Filter */}
      <FilterSection>
        <SectionLabel icon={Calendar}>Crawled Date Range</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="dateFrom" className="text-[11px] text-muted-foreground mb-1 block">
              From
            </Label>
            <Input
              id="dateFrom"
              type="date"
              value={localFilters.dateFrom || ''}
              onChange={(e) => handleDateChange('dateFrom', e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="dateTo" className="text-[11px] text-muted-foreground mb-1 block">
              To
            </Label>
            <Input
              id="dateTo"
              type="date"
              value={localFilters.dateTo || ''}
              onChange={(e) => handleDateChange('dateTo', e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
      </FilterSection>

      {/* State Filter */}
      <FilterSection>
        <SectionLabel icon={MapPin}>State</SectionLabel>
        <select
          id="state"
          value={localFilters.state || ''}
          onChange={(e) => handleStateChange(e.target.value)}
          className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm hover:bg-muted/50 transition-colors"
        >
          <option value="">All States</option>
          {US_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </FilterSection>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="pt-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-accent/60 mb-2 block">
            Active Filters
          </label>
          <div className="flex flex-wrap gap-1.5">
            {localFilters.documentType?.map((type) => {
              const typeLabel = DOCUMENT_TYPES.find((t) => t.value === type)?.label || type
              return (
                <Button
                  key={type}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDocumentTypeChange(type, false)}
                  className="h-7 text-xs hover:bg-destructive/10 hover:text-destructive"
                >
                  {typeLabel}
                  <X className="h-3 w-3 ml-1" />
                </Button>
              )
            })}
            {localFilters.dateFrom && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDateChange('dateFrom', '')}
                className="h-7 text-xs hover:bg-destructive/10 hover:text-destructive"
              >
                From: {localFilters.dateFrom}
                <X className="h-3 w-3 ml-1" />
              </Button>
            )}
            {localFilters.dateTo && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDateChange('dateTo', '')}
                className="h-7 text-xs hover:bg-destructive/10 hover:text-destructive"
              >
                To: {localFilters.dateTo}
                <X className="h-3 w-3 ml-1" />
              </Button>
            )}
            {localFilters.state && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleStateChange('')}
                className="h-7 text-xs hover:bg-destructive/10 hover:text-destructive"
              >
                State: {localFilters.state}
                <X className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
