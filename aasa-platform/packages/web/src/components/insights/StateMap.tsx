import { useMemo, useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { scaleLinear } from 'd3-scale'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import type { StateStats } from '@aasa-platform/shared'

// US States TopoJSON URL (public CDN)
const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

// State FIPS code to state abbreviation mapping
const FIPS_TO_STATE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY',
}

type ColorMetric = 'coverage' | 'score' | 'districts' | 'tier1'

interface StateMapProps {
  states: StateStats[]
  loading: boolean
  onStateClick: (stateCode: string) => void
  selectedState: string | null
}

/**
 * StateMap - Interactive US map with states colored by selected metric
 * Click a state to open detail panel
 */
export function StateMap({ states, loading, onStateClick, selectedState }: StateMapProps) {
  const [colorMetric, setColorMetric] = useState<ColorMetric>('coverage')
  const [tooltipContent, setTooltipContent] = useState<string | null>(null)

  // Create lookup map for state data
  const stateDataMap = useMemo(() => {
    const map = new Map<string, StateStats>()
    states.forEach((state) => {
      map.set(state.stateCode, state)
    })
    return map
  }, [states])

  // Color range based on selected metric
  const colorRange = useMemo((): [string, string] => {
    switch (colorMetric) {
      case 'coverage':
        return ['#fef3c7', '#10b981'] // Yellow to green
      case 'score':
        return ['#fecaca', '#3b82f6'] // Red to blue
      case 'districts':
        return ['#e0e7ff', '#4f46e5'] // Light indigo to indigo
      case 'tier1':
        return ['#d1fae5', '#059669'] // Light green to emerald
    }
  }, [colorMetric])

  // Color scale based on selected metric
  const colorScale = useMemo(() => {
    if (states.length === 0) {
      return scaleLinear<string>().domain([0, 1]).range(colorRange)
    }

    let domain: [number, number]

    switch (colorMetric) {
      case 'coverage':
        domain = [0, 100]
        break
      case 'score':
        domain = [0, 10]
        break
      case 'districts':
        const maxDistricts = Math.max(...states.map((s) => s.totalDistricts))
        domain = [0, maxDistricts]
        break
      case 'tier1':
        const maxTier1 = Math.max(...states.map((s) => s.tier1Count))
        domain = [0, maxTier1]
        break
    }

    return scaleLinear<string>().domain(domain).range(colorRange)
  }, [states, colorMetric, colorRange])

  // Get value for a state based on selected metric
  const getMetricValue = (state: StateStats | undefined): number => {
    if (!state) return 0
    switch (colorMetric) {
      case 'coverage':
        return state.superintendentCoverage
      case 'score':
        return state.avgTotalScore
      case 'districts':
        return state.totalDistricts
      case 'tier1':
        return state.tier1Count
    }
  }

  // Get fill color for a state
  const getFillColor = (stateCode: string): string => {
    const stateData = stateDataMap.get(stateCode)
    if (!stateData) return '#f1f5f9' // Light gray for no data
    return colorScale(getMetricValue(stateData))
  }

  // Get tooltip text
  const getTooltipText = (stateCode: string): string => {
    const stateData = stateDataMap.get(stateCode)
    if (!stateData) return `${stateCode}: No data`

    switch (colorMetric) {
      case 'coverage':
        return `${stateData.stateName}: ${stateData.superintendentCoverage.toFixed(1)}% coverage`
      case 'score':
        return `${stateData.stateName}: ${stateData.avgTotalScore.toFixed(1)} avg score`
      case 'districts':
        return `${stateData.stateName}: ${stateData.totalDistricts.toLocaleString()} districts`
      case 'tier1':
        return `${stateData.stateName}: ${stateData.tier1Count} Tier 1`
    }
  }

  const metricOptions: { value: ColorMetric; label: string }[] = [
    { value: 'coverage', label: 'Coverage %' },
    { value: 'score', label: 'Avg Score' },
    { value: 'districts', label: 'Districts' },
    { value: 'tier1', label: 'Tier 1' },
  ]

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>State Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] bg-muted animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>State Overview</CardTitle>
        <div className="flex gap-1">
          {metricOptions.map((option) => (
            <Button
              key={option.value}
              variant={colorMetric === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setColorMetric(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {tooltipContent && (
            <div className="absolute top-2 left-2 z-10 bg-popover text-popover-foreground px-3 py-1.5 rounded-md shadow-md text-sm">
              {tooltipContent}
            </div>
          )}
          <ComposableMap
            projection="geoAlbersUsa"
            style={{ width: '100%', height: 'auto' }}
          >
            <ZoomableGroup center={[-96, 38]} zoom={1}>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const fipsCode = geo.id
                    const stateCode = FIPS_TO_STATE[fipsCode]

                    if (!stateCode) return null

                    const isSelected = selectedState === stateCode
                    const fillColor = getFillColor(stateCode)

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fillColor}
                        stroke={isSelected ? '#1e40af' : '#94a3b8'}
                        strokeWidth={isSelected ? 2 : 0.5}
                        style={{
                          default: { outline: 'none' },
                          hover: { outline: 'none', fill: '#94a3b8', cursor: 'pointer' },
                          pressed: { outline: 'none' },
                        }}
                        onMouseEnter={() => setTooltipContent(getTooltipText(stateCode))}
                        onMouseLeave={() => setTooltipContent(null)}
                        onClick={() => onStateClick(stateCode)}
                      />
                    )
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-xs text-muted-foreground">Low</span>
          <div
            className="h-3 w-32 rounded"
            style={{
              background: `linear-gradient(to right, ${colorScale.range()[0]}, ${colorScale.range()[1]})`,
            }}
          />
          <span className="text-xs text-muted-foreground">High</span>
        </div>
      </CardContent>
    </Card>
  )
}
