import { DocumentCard } from './DocumentCard'
import { EmptyState } from './EmptyState'
import { Loader2 } from 'lucide-react'
import type { SemanticSearchResult } from '@aasa-platform/shared'

interface SearchResultsListProps {
  results: SemanticSearchResult[] | undefined
  loading: boolean
  onDocumentClick: (documentId: string) => void
  error?: string | null
}

/**
 * Search results grid with loading and empty states
 * Displays documents in a responsive grid layout
 */
export function SearchResultsList({
  results,
  loading,
  onDocumentClick,
  error,
}: SearchResultsListProps) {
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Searching documents...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <EmptyState
        title="Search Failed"
        description={error}
        action={{
          label: 'Try Again',
          onClick: () => window.location.reload(),
        }}
      />
    )
  }

  // Empty state (no results)
  if (!results || results.length === 0) {
    return (
      <EmptyState
        title="No Documents Found"
        description="Try different keywords or adjust your filters"
      />
    )
  }

  // Results count
  const resultText =
    results.length === 1
      ? 'Found 1 document'
      : `Found ${results.length} document${results.length === 1 ? '' : 's'}`

  return (
    <div className="space-y-4">
      {/* Result count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{resultText}</p>
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result) => (
          <DocumentCard
            key={result.document.id}
            document={result.document}
            district={result.district}
            relevanceScore={result.relevanceScore}
            onSelect={() => onDocumentClick(result.document.id)}
            showDistrict={true}
          />
        ))}
      </div>
    </div>
  )
}
