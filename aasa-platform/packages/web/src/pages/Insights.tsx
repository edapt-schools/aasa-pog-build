import { useState } from 'react'
import { NationalOverviewCards } from '../components/insights/NationalOverviewCards'
import { StateMap } from '../components/insights/StateMap'
import { StateDetailPanel } from '../components/insights/StateDetailPanel'
import { TrendingKeywords } from '../components/insights/TrendingKeywords'
import { TierDistributionChart } from '../components/insights/TierDistributionChart'
import { useInsightsOverview } from '../hooks/useInsightsOverview'
import { useAllStateStats } from '../hooks/useStateStats'
import { useTrending } from '../hooks/useTrending'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

/**
 * Insights Mode - Analytics dashboard for AASA leadership
 * Features:
 * - National overview statistics
 * - Interactive US map colored by selected metric
 * - State detail panel on click
 * - Trending keywords visualization
 * - Tier distribution chart
 * - State comparison table
 */
export default function Insights() {
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [trendingPeriod, setTrendingPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  // Fetch data with hooks
  const { data: overviewData, loading: overviewLoading } = useInsightsOverview()
  const { data: statesData, loading: statesLoading } = useAllStateStats()
  const { data: trendingData, loading: trendingLoading } = useTrending(trendingPeriod)

  // Handle state selection
  const handleStateClick = (stateCode: string) => {
    setSelectedState(stateCode)
  }

  const handleClosePanel = () => {
    setSelectedState(null)
  }

  // Sort states for table (by total districts descending)
  const sortedStates = statesData?.states
    ? [...statesData.states].sort((a, b) => b.totalDistricts - a.totalDistricts)
    : []

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background sticky top-0 z-30">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-heading-3 text-foreground">Insights Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                National overview and state-level analytics
              </p>
            </div>
            {overviewData && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(overviewData.lastUpdated).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 space-y-6">
        {/* Overview Cards */}
        <NationalOverviewCards data={overviewData} loading={overviewLoading} />

        {/* Map and Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map - takes 2 columns */}
          <div className="lg:col-span-2">
            <StateMap
              states={statesData?.states || []}
              loading={statesLoading}
              onStateClick={handleStateClick}
              selectedState={selectedState}
            />
          </div>

          {/* Tier Distribution - takes 1 column */}
          <div>
            <TierDistributionChart
              tierDistribution={
                overviewData?.tierDistribution || { tier1: 0, tier2: 0, tier3: 0 }
              }
              loading={overviewLoading}
            />
          </div>
        </div>

        {/* Trending Keywords */}
        <TrendingKeywords
          keywords={trendingData?.keywords || []}
          loading={trendingLoading}
          period={trendingPeriod}
          onPeriodChange={setTrendingPeriod}
        />

        {/* State Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle>State Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {statesLoading ? (
              <div className="h-64 bg-muted animate-pulse rounded-lg" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        State
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                        Districts
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                        Coverage
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                        Avg Score
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                        Tier 1
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                        Documents
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStates.slice(0, 20).map((state) => (
                      <tr
                        key={state.stateCode}
                        className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{state.stateName}</span>
                            <Badge variant="outline" className="text-xs">
                              {state.stateCode}
                            </Badge>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4">
                          {state.totalDistricts.toLocaleString()}
                        </td>
                        <td className="text-right py-3 px-4">
                          <span
                            className={
                              state.superintendentCoverage >= 50
                                ? 'text-emerald-600'
                                : state.superintendentCoverage >= 25
                                  ? 'text-amber-600'
                                  : 'text-slate-500'
                            }
                          >
                            {state.superintendentCoverage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-right py-3 px-4">
                          {state.avgTotalScore > 0 ? state.avgTotalScore.toFixed(1) : '-'}
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className="text-emerald-600 font-medium">
                            {state.tier1Count}
                          </span>
                        </td>
                        <td className="text-right py-3 px-4">
                          {state.documentsCount.toLocaleString()}
                        </td>
                        <td className="text-center py-3 px-4">
                          <button
                            onClick={() => handleStateClick(state.stateCode)}
                            className="text-primary hover:underline text-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {sortedStates.length > 20 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Showing top 20 states by district count
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* State Detail Panel */}
      {selectedState && (
        <StateDetailPanel stateCode={selectedState} onClose={handleClosePanel} />
      )}
    </div>
  )
}
