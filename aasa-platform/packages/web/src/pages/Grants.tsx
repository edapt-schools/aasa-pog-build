import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchBar } from '../components/SearchBar'
import { SearchResultsList } from '../components/SearchResultsList'
import { SearchFilters } from '../components/SearchFilters'
import { DocumentDetailPanel } from '../components/DocumentDetailPanel'
import { useSemanticSearch } from '../hooks/useSemanticSearch'
import { Menu, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import type { SearchFilters as SearchFiltersType, SemanticSearchParams, DistrictDocument, District } from '@aasa-platform/shared'

/**
 * Grants Mode - Semantic search across all district documents
 * Features:
 * - Natural language search with relevance scoring
 * - Document type and date filters
 * - Document detail panel with keyword evidence
 * - Similar documents recommendations
 */
export default function Grants() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState<string>(searchParams.get('q') || '')
  const [filters, setFilters] = useState<SearchFiltersType>({})
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false)

  // Build search params for API - pass all filters
  const searchApiParams: SemanticSearchParams | null = query.trim()
    ? {
        query: query.trim(),
        limit: 50, // Max 50 results
        state: filters.state,
        documentTypes: filters.documentType,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }
    : null

  // Fetch search results
  const { data, loading, error } = useSemanticSearch(searchApiParams)

  // Find the selected document from results for the detail panel
  const selectedResult = data?.results.find(r => r.document.id === selectedDocumentId)

  // Handle selecting a different document (e.g., from similar docs)
  const handleDocumentSelect = (docId: string, _doc: DistrictDocument, _district: District) => {
    setSelectedDocumentId(docId)
  }

  // Handle search execution
  const handleSearch = () => {
    if (!query.trim()) return

    // Update URL query params
    setSearchParams({ q: query.trim() })

    // Close mobile filter drawer
    setIsFilterDrawerOpen(false)
  }

  // Handle document click
  const handleDocumentClick = (documentId: string) => {
    setSelectedDocumentId(documentId)
  }

  // Sync query from URL on mount
  useEffect(() => {
    const urlQuery = searchParams.get('q')
    if (urlQuery && urlQuery !== query) {
      setQuery(urlQuery)
    }
  }, [searchParams])

  // Handle ESC key to close drawer/panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedDocumentId) {
          setSelectedDocumentId(null)
        } else if (isFilterDrawerOpen) {
          setIsFilterDrawerOpen(false)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedDocumentId, isFilterDrawerOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile filter drawer backdrop */}
      {isFilterDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsFilterDrawerOpen(false)}
        />
      )}

      {/* Filter sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-background border-r border-border
          transform transition-transform duration-300 ease-in-out
          overflow-y-auto
          ${isFilterDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Mobile close button */}
        <div className="lg:hidden sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
          <h2 className="font-semibold">Filters</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFilterDrawerOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4">
          <SearchFilters filters={filters} onChange={setFilters} />
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header with search bar */}
        <header className="border-b border-border bg-background sticky top-0 z-30">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  aria-label="Open filters"
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-heading-3 text-foreground">Grants Mode</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Search across 87,883 district documents
                  </p>
                </div>
              </div>
            </div>

            {/* Search bar */}
            <SearchBar
              value={query}
              onChange={setQuery}
              onSearch={handleSearch}
              placeholder="Search for 'portrait of a graduate', 'equity initiatives', etc."
              isLoading={loading}
            />
          </div>
        </header>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!query.trim() && !data ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
              <h2 className="text-heading-4 text-foreground mb-2">
                Search District Documents
              </h2>
              <p className="text-muted-foreground mb-6">
                Use natural language to search across strategic plans, board policies, annual reports, and more.
                Our AI-powered search understands context and finds relevant documents based on meaning.
              </p>
              <div className="space-y-2 text-sm text-muted-foreground text-left w-full">
                <p className="font-medium">Try searching for:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>"portrait of a graduate"</li>
                  <li>"competency-based learning"</li>
                  <li>"social emotional learning initiatives"</li>
                  <li>"equity and inclusion policies"</li>
                </ul>
              </div>
            </div>
          ) : (
            <SearchResultsList
              results={data?.results}
              loading={loading}
              onDocumentClick={handleDocumentClick}
              error={error}
            />
          )}
        </div>
      </main>

      {/* Document detail panel */}
      {selectedDocumentId && selectedResult && (
        <DocumentDetailPanel
          documentId={selectedDocumentId}
          document={selectedResult.document}
          district={selectedResult.district}
          chunkText={selectedResult.chunkText}
          relevanceScore={selectedResult.relevanceScore}
          onClose={() => setSelectedDocumentId(null)}
          onDocumentSelect={handleDocumentSelect}
        />
      )}

      {/* ARIA live region for screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {loading && 'Searching documents'}
        {data && `Found ${data.results.length} documents matching "${query}"`}
        {error && `Error: ${error}`}
      </div>
    </div>
  )
}
