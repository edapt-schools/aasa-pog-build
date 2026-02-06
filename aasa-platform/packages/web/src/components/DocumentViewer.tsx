import { useState } from 'react'
import { Card, CardHeader, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { ExternalLink, Copy, FileText, File, Globe } from 'lucide-react'
import type { DistrictDocument } from '@aasa-platform/shared'

interface DocumentViewerProps {
  document: DistrictDocument
  compact?: boolean
}

/**
 * Display a document with metadata, excerpt, and actions
 * Used inline in DocumentList or as standalone viewer
 */
export function DocumentViewer({ document, compact = false }: DocumentViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // TODO: Add toast notification
  }

  // Determine document type icon
  const getDocumentIcon = () => {
    const type = document.documentType?.toLowerCase() || ''
    if (type.includes('pdf')) {
      return <FileText className="h-4 w-4" />
    } else if (type.includes('doc') || type.includes('word')) {
      return <File className="h-4 w-4" />
    } else {
      return <Globe className="h-4 w-4" />
    }
  }

  // Get badge variant based on document type
  const getTypeVariant = () => {
    const type = document.documentType?.toLowerCase() || ''
    if (type.includes('pdf')) return 'destructive'
    if (type.includes('strategic') || type.includes('plan')) return 'default'
    return 'secondary'
  }

  // Format date
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Unknown'
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Excerpt handling
  const excerpt = document.extractedText || ''
  const EXCERPT_LENGTH = 500
  const needsTruncation = excerpt.length > EXCERPT_LENGTH
  const displayText = isExpanded ? excerpt : excerpt.slice(0, EXCERPT_LENGTH)

  // Compact mode renders a simpler card
  if (compact) {
    return (
      <Card className="bg-card border border-border hover:border-accent transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {getDocumentIcon()}
                <Badge variant={getTypeVariant()} className="text-xs">
                  {document.documentType || 'Document'}
                </Badge>
                {document.documentCategory && (
                  <Badge variant="outline" className="text-xs">
                    {document.documentCategory}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{displayText}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(document.documentUrl, '_blank', 'noopener,noreferrer')}
              aria-label="View full document"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Full mode renders detailed view
  return (
    <Card className="bg-card border border-border">
      <CardHeader className="border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {getDocumentIcon()}
            <Badge variant={getTypeVariant()}>
              {document.documentType || 'Document'}
            </Badge>
            {document.documentCategory && (
              <Badge variant="outline">{document.documentCategory}</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Crawled {formatDate(document.lastCrawledAt)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Document URL */}
        {document.documentUrl && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">URL:</span>
            <a
              href={document.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate flex-1"
            >
              {document.documentUrl}
            </a>
          </div>
        )}

        {/* Text content with Read More toggle */}
        {excerpt && (
          <div className="space-y-2">
            <div className="text-sm text-foreground whitespace-pre-wrap">
              {displayText}
              {!isExpanded && needsTruncation && (
                <span className="text-muted-foreground">...</span>
              )}
            </div>

            {needsTruncation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {isExpanded ? 'Read Less' : 'Read More'}
              </Button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(document.documentUrl, '_blank', 'noopener,noreferrer')}
            className="flex-1 sm:flex-none"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Full Document
          </Button>
          {excerpt && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(excerpt)}
              aria-label="Copy excerpt"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Metadata */}
        {document.textLength && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
            <span>{document.textLength.toLocaleString()} characters</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
