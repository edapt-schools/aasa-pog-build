import { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, FileText, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardContent } from './ui/card'
import { Badge } from './ui/badge'

interface ScoreBreakdownProps {
  keywordMatches?: Record<string, unknown> | null
}

const CATEGORY_META: Record<string, { label: string; color: string; weight: string; description: string }> = {
  readiness: {
    label: 'Readiness',
    color: 'text-blue-600 dark:text-blue-400',
    weight: '35%',
    description: 'Portrait of a Graduate, strategic vision, AI readiness',
  },
  alignment: {
    label: 'Alignment',
    color: 'text-emerald-600 dark:text-emerald-400',
    weight: '25%',
    description: 'Portrait to Practice, educator competencies, frameworks for learning',
  },
  activation: {
    label: 'Activation',
    color: 'text-cyan-600 dark:text-cyan-400',
    weight: '25%',
    description: 'Measure What Matters, performance tasks, impact showcases',
  },
  branding: {
    label: 'Branding',
    color: 'text-amber-600 dark:text-amber-400',
    weight: '15%',
    description: 'Strategic storytelling, messaging frameworks, communications',
  },
}

function CategoryBreakdown({
  categoryKey,
  matches,
}: {
  categoryKey: string
  matches: Array<{ keyword: string; weight: number; source_doc: string; context?: string; dampened?: boolean }>
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = CATEGORY_META[categoryKey]

  if (!matches || matches.length === 0) {
    return (
      <div className="py-3 border-b border-border last:border-b-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${meta?.color || 'text-foreground'}`}>
              {meta?.label || categoryKey}
            </span>
            <span className="text-xs text-muted-foreground">({meta?.weight || ''})</span>
          </div>
          <span className="text-xs text-muted-foreground">No matches</span>
        </div>
      </div>
    )
  }

  // Group matches by keyword
  const byKeyword = new Map<string, typeof matches>()
  for (const match of matches) {
    const existing = byKeyword.get(match.keyword) || []
    existing.push(match)
    byKeyword.set(match.keyword, existing)
  }

  return (
    <div className="py-3 border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className={`text-sm font-medium ${meta?.color || 'text-foreground'}`}>
            {meta?.label || categoryKey}
          </span>
          <span className="text-xs text-muted-foreground">({meta?.weight || ''})</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {byKeyword.size} keyword{byKeyword.size !== 1 ? 's' : ''}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {matches.length} match{matches.length !== 1 ? 'es' : ''}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 ml-6 space-y-3">
          {Array.from(byKeyword.entries()).map(([keyword, keywordMatches]) => (
            <div key={keyword} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-foreground">
                  {keyword.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-muted-foreground">
                  (best weight: {Math.max(...keywordMatches.map(m => m.weight)).toFixed(2)})
                </span>
              </div>

              {keywordMatches.map((match, i) => (
                <div
                  key={`${match.source_doc}-${i}`}
                  className="ml-3 pl-3 border-l-2 border-border"
                >
                  {match.dampened && (
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Score dampened (negative signal nearby)
                      </span>
                    </div>
                  )}

                  {match.context && (
                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                      "{match.context}"
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 mt-1">
                    <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                    <a
                      href={match.source_doc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate max-w-xs"
                      title={match.source_doc}
                    >
                      {new URL(match.source_doc).pathname.split('/').pop() || match.source_doc}
                      <ExternalLink className="w-2.5 h-2.5 inline ml-1" />
                    </a>
                    <span className="text-xs text-muted-foreground shrink-0">
                      w={match.weight.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ScoreBreakdown({ keywordMatches }: ScoreBreakdownProps) {
  const [expanded, setExpanded] = useState(false)

  if (!keywordMatches || Object.keys(keywordMatches).length === 0) {
    return (
      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            No keyword matches found for this district. This could mean the district
            hasn't published content about Portrait of a Graduate, strategic planning,
            or related topics.
          </p>
        </CardContent>
      </Card>
    )
  }

  const categories = ['readiness', 'alignment', 'activation', 'branding']
  const totalMatches = categories.reduce((sum, cat) => {
    const matches = keywordMatches[cat] as Array<unknown> | undefined
    return sum + (matches?.length || 0)
  }, 0)

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="border-b border-border p-4">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <h3 className="text-lg font-semibold text-foreground">Score Breakdown</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {totalMatches} match{totalMatches !== 1 ? 'es' : ''} across{' '}
            {categories.filter(c => {
              const m = keywordMatches[c] as Array<unknown> | undefined
              return m && m.length > 0
            }).length}{' '}
            categories
          </span>
        </button>
        {!expanded && (
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            Click to see which keywords matched in which documents, with context and weights
          </p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-4">
            Each keyword match shows the source document, surrounding context, and computed weight.
            Weights factor in keyword importance, document recency, and content specificity.
            Dampened matches indicate a negative signal (e.g., "AI ban") was detected nearby.
          </p>

          {categories.map((cat) => (
            <CategoryBreakdown
              key={cat}
              categoryKey={cat}
              matches={(keywordMatches[cat] as Array<{
                keyword: string
                weight: number
                source_doc: string
                context?: string
                dampened?: boolean
              }>) || []}
            />
          ))}
        </CardContent>
      )}
    </Card>
  )
}
