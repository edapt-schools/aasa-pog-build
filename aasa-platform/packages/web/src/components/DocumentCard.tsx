import { FileText, File, Globe } from 'lucide-react'
import { Card, CardContent, CardHeader } from './ui/card'
import { Badge } from './ui/badge'
import type { DistrictDocument, District } from '@aasa-platform/shared'

interface DocumentCardProps {
  document: DistrictDocument
  district?: District
  relevanceScore?: number // 0-1 from semantic search
  onSelect: () => void
  showDistrict?: boolean // Show district name if cross-district search
}

/**
 * Document card for search results
 * Shows document type, title, excerpt, and relevance score
 */
export function DocumentCard({
  document,
  district,
  relevanceScore,
  onSelect,
  showDistrict = false,
}: DocumentCardProps) {
  // Get document type icon
  const getDocumentIcon = () => {
    const type = document.documentType?.toLowerCase() || ''
    if (type.includes('pdf')) return <FileText className="h-4 w-4" />
    if (type.includes('web')) return <Globe className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  // Get document type badge color
  const getTypeBadgeColor = () => {
    const type = document.documentType?.toLowerCase() || ''
    if (type.includes('strategic')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    if (type.includes('board')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    if (type.includes('annual')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  }

  // Get excerpt text (first 150 chars)
  const getExcerpt = () => {
    if (!document.extractedText) return 'No preview available'
    const text = document.extractedText.trim()
    return text.length > 150 ? text.substring(0, 150) + '...' : text
  }

  // Format relevance score as percentage
  const scorePercent = relevanceScore ? Math.round(relevanceScore * 100) : null

  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-accent"
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Document type badge */}
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className={getTypeBadgeColor()}>
                <span className="mr-1">{getDocumentIcon()}</span>
                {document.documentType || 'Document'}
              </Badge>
              {document.documentCategory && (
                <span className="text-xs text-muted-foreground">
                  {document.documentCategory}
                </span>
              )}
            </div>

            {/* Document title */}
            <h3 className="text-sm font-semibold text-foreground line-clamp-2">
              {document.documentTitle || 'Untitled Document'}
            </h3>

            {/* District name (if cross-district search) */}
            {showDistrict && district && (
              <p className="text-xs text-muted-foreground mt-1">
                {district.name}, {district.state}
              </p>
            )}
          </div>

          {/* Relevance score badge */}
          {scorePercent !== null && (
            <Badge
              variant="outline"
              className="shrink-0 font-semibold"
              style={{
                background: `linear-gradient(135deg, hsl(var(--accent) / 0.1) 0%, hsl(var(--accent) / 0.2) 100%)`,
                borderColor: 'hsl(var(--accent))',
                color: 'hsl(var(--accent-foreground))',
              }}
            >
              {scorePercent}%
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Document excerpt */}
        <p className="text-sm text-muted-foreground line-clamp-3">
          {getExcerpt()}
        </p>

        {/* Document URL */}
        {document.documentUrl && (
          <p className="text-xs text-muted-foreground mt-2 truncate">
            {document.documentUrl}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
