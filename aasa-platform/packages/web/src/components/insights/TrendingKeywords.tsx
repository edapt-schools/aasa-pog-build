import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import type { TrendingKeyword } from '@aasa-platform/shared'

interface TrendingKeywordsProps {
  keywords: TrendingKeyword[]
  loading: boolean
  period: '7d' | '30d' | '90d'
  onPeriodChange: (period: '7d' | '30d' | '90d') => void
}

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  readiness: '#3b82f6', // Blue
  alignment: '#10b981', // Green
  activation: '#f97316', // Orange
  branding: '#8b5cf6', // Purple
}

/**
 * TrendingKeywords - Bar chart showing top keywords by frequency
 * Grouped by category with period toggle
 */
export function TrendingKeywords({
  keywords,
  loading,
  period,
  onPeriodChange,
}: TrendingKeywordsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Filter keywords by selected category
  const filteredKeywords = selectedCategory
    ? keywords.filter((k) => k.category === selectedCategory)
    : keywords

  // Prepare data for chart (top 10)
  const chartData = filteredKeywords.slice(0, 10).map((k) => ({
    keyword: k.keyword.length > 20 ? k.keyword.substring(0, 20) + '...' : k.keyword,
    fullKeyword: k.keyword,
    count: k.currentCount,
    category: k.category,
    color: CATEGORY_COLORS[k.category],
  }))

  const periods: { value: '7d' | '30d' | '90d'; label: string }[] = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
  ]

  const categories = ['readiness', 'alignment', 'activation', 'branding']

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trending Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Trending Keywords</CardTitle>
        <div className="flex gap-1">
          {periods.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {/* Category filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Badge
            variant={selectedCategory === null ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className="cursor-pointer capitalize"
              style={{
                backgroundColor: selectedCategory === cat ? CATEGORY_COLORS[cat] : undefined,
                borderColor: CATEGORY_COLORS[cat],
              }}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>

        {chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No keyword data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="keyword"
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-popover text-popover-foreground p-3 rounded-lg shadow-lg border">
                        <p className="font-medium">{data.fullKeyword}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          Category: {data.category}
                        </p>
                        <p className="text-sm font-semibold">
                          Found in {data.count} districts
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Legend */}
        <div className="flex justify-center gap-4 mt-4">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: CATEGORY_COLORS[cat] }}
              />
              <span className="text-xs capitalize text-muted-foreground">{cat}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
