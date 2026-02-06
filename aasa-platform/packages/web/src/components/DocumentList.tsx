import { Card, CardHeader, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import type { DistrictDocument } from '@aasa-platform/shared'

interface DocumentListProps {
  documents: DistrictDocument[]
  onDocumentClick?: (document: DistrictDocument) => void
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

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
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
              {doc.pageDepth && <span>Depth: {doc.pageDepth}</span>}
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

            {/* Timestamps */}
            {doc.lastCrawledAt && (
              <div className="text-xs text-muted-foreground pt-2">
                Last crawled:{' '}
                {new Date(doc.lastCrawledAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
