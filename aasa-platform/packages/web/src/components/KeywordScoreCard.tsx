import { Card, CardHeader, CardContent } from './ui/card'
import { Badge } from './ui/badge'

interface KeywordScoreCardProps {
  scores: {
    readinessScore: string | null
    alignmentScore: string | null
    activationScore: string | null
    brandingScore: string | null
    totalScore: string | null
    outreachTier: string | null
  }
  showDetails?: boolean
}

export function KeywordScoreCard({ scores, showDetails = false }: KeywordScoreCardProps) {
  const categories = [
    {
      name: 'Readiness',
      score: scores.readinessScore,
      description: 'District readiness indicators',
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      name: 'Alignment',
      score: scores.alignmentScore,
      description: 'Strategic alignment markers',
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      name: 'Activation',
      score: scores.activationScore,
      description: 'Engagement and activation signals',
      color: 'text-cyan-600 dark:text-cyan-400',
    },
    {
      name: 'Branding',
      score: scores.brandingScore,
      description: 'Brand presence and messaging',
      color: 'text-amber-600 dark:text-amber-400',
    },
  ]

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'tier1':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'tier2':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'tier3':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getScoreBar = (score: string | null, maxScore: number = 100) => {
    if (!score) return 0
    const numScore = parseFloat(score)
    return (numScore / maxScore) * 100
  }

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Keyword Scores</h3>
          {scores.outreachTier && (
            <Badge className={getTierColor(scores.outreachTier)}>
              {scores.outreachTier.toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Total Score */}
        {scores.totalScore && (
          <div className="pb-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Total Score</span>
              <span className="text-2xl font-bold text-foreground">
                {parseFloat(scores.totalScore).toFixed(1)}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${getScoreBar(scores.totalScore, 400)}%` }}
              />
            </div>
          </div>
        )}

        {/* Category Scores */}
        <div className="space-y-3">
          {categories.map((category) => (
            <div key={category.name}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${category.color}`}>
                  {category.name}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {category.score ? parseFloat(category.score).toFixed(1) : '0.0'}
                </span>
              </div>
              {showDetails && (
                <p className="text-xs text-muted-foreground mb-2">
                  {category.description}
                </p>
              )}
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${category.color.replace('text-', 'bg-')} transition-all`}
                  style={{ width: `${getScoreBar(category.score)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Score Legend */}
        {showDetails && (
          <div className="pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Tier 1:</strong> High priority (Total {'>'} 250)
              </p>
              <p>
                <strong>Tier 2:</strong> Medium priority (Total 100-250)
              </p>
              <p>
                <strong>Tier 3:</strong> Lower priority (Total {'<'} 100)
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
