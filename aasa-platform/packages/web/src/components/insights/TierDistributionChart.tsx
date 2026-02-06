import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface TierDistributionChartProps {
  tierDistribution: {
    tier1: number
    tier2: number
    tier3: number
  }
  loading: boolean
}

const TIER_COLORS = {
  tier1: '#10b981', // Emerald
  tier2: '#f59e0b', // Amber
  tier3: '#94a3b8', // Slate
}

const TIER_LABELS = {
  tier1: 'Tier 1 (High Priority)',
  tier2: 'Tier 2 (Medium)',
  tier3: 'Tier 3 (Lower)',
}

/**
 * TierDistributionChart - Donut chart showing tier distribution
 * Shows the breakdown of districts by outreach tier
 */
export function TierDistributionChart({ tierDistribution, loading }: TierDistributionChartProps) {
  const total = tierDistribution.tier1 + tierDistribution.tier2 + tierDistribution.tier3

  const data = [
    { name: TIER_LABELS.tier1, value: tierDistribution.tier1, tier: 'tier1' },
    { name: TIER_LABELS.tier2, value: tierDistribution.tier2, tier: 'tier2' },
    { name: TIER_LABELS.tier3, value: tierDistribution.tier3, tier: 'tier3' },
  ]

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tier Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] bg-muted animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tier Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            No scored districts yet
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tier Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.tier}
                  fill={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-popover text-popover-foreground p-3 rounded-lg shadow-lg border">
                      <p className="font-medium">{data.name}</p>
                      <p className="text-sm">
                        {data.value.toLocaleString()} districts
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {((data.value / total) * 100).toFixed(1)}% of total
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Summary stats below chart */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{tierDistribution.tier1}</p>
            <p className="text-xs text-muted-foreground">Tier 1</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{tierDistribution.tier2}</p>
            <p className="text-xs text-muted-foreground">Tier 2</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-600">{tierDistribution.tier3}</p>
            <p className="text-xs text-muted-foreground">Tier 3</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
