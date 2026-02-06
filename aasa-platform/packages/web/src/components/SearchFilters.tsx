import { useState } from 'react'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { X } from 'lucide-react'
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
    <div className="space-y-6">
      {/* Header with clear button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Filters</h3>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-xs h-8 px-2"
          >
            <X className="h-3 w-3 mr-1" />
            Clear ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Document Type Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Document Type</Label>
        <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
          {DOCUMENT_TYPES.map((type) => (
            <div key={type.value} className="flex items-center space-x-2">
              <Checkbox
                id={`type-${type.value}`}
                checked={localFilters.documentType?.includes(type.value) || false}
                onCheckedChange={(checked) =>
                  handleDocumentTypeChange(type.value, checked === true)
                }
              />
              <label
                htmlFor={`type-${type.value}`}
                className="text-sm cursor-pointer"
              >
                {type.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Crawled Date Range</Label>
        <div className="space-y-2">
          <div>
            <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="dateFrom"
              type="date"
              value={localFilters.dateFrom || ''}
              onChange={(e) => handleDateChange('dateFrom', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="dateTo" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="dateTo"
              type="date"
              value={localFilters.dateTo || ''}
              onChange={(e) => handleDateChange('dateTo', e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* State Filter (for cross-district search) */}
      <div className="space-y-3">
        <Label htmlFor="state" className="text-sm font-medium">
          State
        </Label>
        <select
          id="state"
          value={localFilters.state || ''}
          onChange={(e) => handleStateChange(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
        >
          <option value="">All States</option>
          {US_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="pt-4 border-t space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Active Filters</Label>
          <div className="flex flex-wrap gap-2">
            {localFilters.documentType?.map((type) => {
              const typeLabel = DOCUMENT_TYPES.find((t) => t.value === type)?.label || type
              return (
                <Button
                  key={type}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDocumentTypeChange(type, false)}
                  className="h-7 text-xs"
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
                className="h-7 text-xs"
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
                className="h-7 text-xs"
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
                className="h-7 text-xs"
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
