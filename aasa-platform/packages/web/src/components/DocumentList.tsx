import { Card, CardHeader, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { AlertTriangle, XCircle, Flag } from 'lucide-react'
import type { DistrictDocument } from '@aasa-platform/shared'

interface DocumentListProps {
  documents: DistrictDocument[]
  onDocumentClick?: (document: DistrictDocument) => void
}

/**
 * Returns a human-readable relative time string (e.g., "3 months ago")
 */
function getRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 1) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  if (diffDays < 60) return '1 month ago'
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  if (diffDays < 730) return '1 year ago'
  return `${Math.floor(diffDays / 365)} years ago`
}

/**
 * Returns staleness level based on crawl age
 */
function getStaleness(dateStr: string | null): 'fresh' | 'stale' | 'very_stale' {
  if (!dateStr) return 'very_stale'
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30)

  if (diffMonths > 12) return 'very_stale'
  if (diffMonths > 6) return 'stale'
  return 'fresh'
}

/**
 * Check if the last crawl indicates a broken link
 */
function isBrokenLink(doc: DistrictDocument): boolean {
  if (doc.lastCrawlStatus === 'failure') return true
  if (doc.lastCrawlHttpStatus && (doc.lastCrawlHttpStatus === 404 || doc.lastCrawlHttpStatus >= 500)) return true
  return false
}

export function DocumentList({ documents, onDocumentClick }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No documents found
      </div>
    )
  }

  const getDocumentTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'pdf':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'html':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'text':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const handleReportBroken = (doc: DistrictDocument, e: React.MouseEvent) => {
    e.stopPropagation()
    console.log('Broken link reported:', {
      documentId: doc.id,
      ncesId: doc.ncesId,
      url: doc.documentUrl,
      reportedAt: new Date().toISOString(),
    })
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => {
        const staleness = getStaleness(doc.lastCrawledAt)
        const broken = isBrokenLink(doc)

        return (
          <Card
            key={doc.id}
            className={`bg-card border border-border ${
              onDocumentClick ? 'cursor-pointer hover:shadow-md hover:border-accent' : ''
            }`}
            onClick={() => onDocumentClick?.(doc)}
          >
            <CardHeader className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-foreground mb-1 truncate">
                    {doc.documentTitle || 'Untitled Document'}
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    {doc.documentType && (
                      <Badge className={getDocumentTypeColor(doc.documentType)}>
                        {doc.documentType.toUpperCase()}
                      </Badge>
                    )}
                    {doc.documentCategory && (
                      <Badge variant="outline" className="text-xs">
                        {doc.documentCategory}
                      </Badge>
                    )}
                    {/* Freshness / broken badges */}
                    {broken && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        <XCircle className="w-3 h-3" />
                        Broken link
                      </span>
                    )}
                    {!broken && staleness === 'very_stale' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        <AlertTriangle className="w-3 h-3" />
                        Likely outdated
                      </span>
                    )}
                    {!broken && staleness === 'stale' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        <AlertTriangle className="w-3 h-3" />
                        May be outdated
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-2">
              {/* URL */}
              <a
                href={doc.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline block truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {doc.documentUrl}
              </a>

              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {doc.textLength && (
                  <span>{(doc.textLength / 1000).toFixed(1)}k chars</span>
                )}
                {doc.pageDepth != null && <span>Depth: {doc.pageDepth}</span>}
                {doc.extractionMethod && (
                  <span>Method: {doc.extractionMethod}</span>
                )}
              </div>

              {/* Extract Preview */}
              {doc.extractedText && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {doc.extractedText.substring(0, 250)}...
                  </p>
                </div>
              )}

              {/* Timestamps + Report button */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  {doc.lastCrawledAt ? (
                    <span>
                      Last crawled: {getRelativeTime(doc.lastCrawledAt)}
                      {doc.lastCrawlHttpStatus && (
                        <span className="ml-1 opacity-60">
                          (HTTP {doc.lastCrawlHttpStatus})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>Crawl date unknown</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => handleReportBroken(doc, e)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  title="Report this link as broken or outdated"
                >
                  <Flag className="w-3 h-3" />
                  Report
                </button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
