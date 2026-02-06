import { Building2, Users, FileText, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import type { InsightsOverviewResponse } from '@aasa-platform/shared'

interface NationalOverviewCardsProps {
  data: InsightsOverviewResponse | null
  loading: boolean
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  loading?: boolean
}

function StatCard({ title, value, subtitle, icon, loading }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded mt-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{value}</p>
            )}
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * NationalOverviewCards - Grid of 4 stat cards showing national metrics
 * Displays total districts, superintendent coverage, documents, and average score
 */
export function NationalOverviewCards({ data, loading }: NationalOverviewCardsProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Districts"
        value={data ? formatNumber(data.totalDistricts) : '-'}
        subtitle="US public school districts"
        icon={<Building2 className="h-6 w-6 text-primary" />}
        loading={loading}
      />

      <StatCard
        title="Superintendent Coverage"
        value={data ? `${data.superintendentCoverage.percent}%` : '-'}
        subtitle={data ? `${formatNumber(data.superintendentCoverage.count)} contacts` : undefined}
        icon={<Users className="h-6 w-6 text-primary" />}
        loading={loading}
      />

      <StatCard
        title="Documents Analyzed"
        value={data ? formatNumber(data.documentStats.totalDocuments) : '-'}
        subtitle="PDFs, strategic plans, & more"
        icon={<FileText className="h-6 w-6 text-primary" />}
        loading={loading}
      />

      <StatCard
        title="Average Score"
        value={data ? data.averageScores.total.toFixed(1) : '-'}
        subtitle="Across all scored districts"
        icon={<TrendingUp className="h-6 w-6 text-primary" />}
        loading={loading}
      />
    </div>
  )
}
