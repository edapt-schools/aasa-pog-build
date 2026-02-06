import { useState, useEffect, useRef } from 'react'
import { X, Copy, ExternalLink, Loader2, FileText, Globe, File, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Card, CardHeader, CardContent } from './ui/card'
import { useKeywordEvidence } from '../hooks/useKeywordEvidence'
import { useSimilarDocuments } from '../hooks/useSimilarDocuments'
import type { DistrictDocument, District, CategoryEvidence, SimilarDocument } from '@aasa-platform/shared'

interface DocumentDetailPanelProps {
  documentId: string
  document: DistrictDocument
  district: District
  chunkText?: string
  relevanceScore?: number
  onClose: () => void
  onDocumentSelect?: (documentId: string, document: DistrictDocument, district: District) => void
}

type TabType = 'details' | 'evidence' | 'similar'

export function DocumentDetailPanel({
  documentId,
  document,
  district,
  chunkText,
  relevanceScore,
  onClose,
  onDocumentSelect,
}: DocumentDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('details')
  const [isExcerptExpanded, setIsExcerptExpanded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch keyword evidence for the district
  const { data: evidenceData, loading: evidenceLoading, error: evidenceError } = useKeywordEvidence(district.ncesId)

  // Fetch similar documents
  const { data: similarData, loading: similarLoading, error: similarError } = useSimilarDocuments(documentId, 10)

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Focus management - focus panel when opened
  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.focus()
    }
  }, [])

  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // TODO: Add toast notification
  }

  // Get document type icon
  const getDocumentIcon = () => {
    const type = document.documentType?.toLowerCase() || ''
    if (type.includes('pdf')) return <FileText className="h-4 w-4" />
    else if (type.includes('doc') || type.includes('word')) return <File className="h-4 w-4" />
    else return <Globe className="h-4 w-4" />
  }

  // Get badge variant based on document type
  const getTypeVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const type = document.documentType?.toLowerCase() || ''
    if (type.includes('pdf')) return 'destructive'
    if (type.includes('strategic') || type.includes('plan')) return 'default'
    return 'secondary'
  }

  // Format the excerpt text
  const excerptText = chunkText || document.extractedText || ''
  const truncatedExcerpt = excerptText.length > 500 ? excerptText.slice(0, 500) + '...' : excerptText

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-full sm:w-4/5 lg:w-3/5 bg-background border-l border-border z-50 overflow-y-auto transform transition-transform duration-300 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-panel-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {getDocumentIcon()}
                <Badge variant={getTypeVariant()}>
                  {document.documentType || 'Document'}
                </Badge>
                {document.documentCategory && (
                  <Badge variant="outline">{document.documentCategory}</Badge>
                )}
                {relevanceScore !== undefined && (
                  <Badge
                    variant="secondary"
                    className="bg-gradient-to-r from-blue-500/20 to-purple-500/20"
                  >
                    {Math.round(relevanceScore * 100)}% match
                  </Badge>
                )}
              </div>
              <h2
                id="document-panel-title"
                className="text-xl font-semibold text-foreground truncate"
              >
                {document.documentTitle || 'Untitled Document'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {district.name}, {district.state}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close panel"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-border">
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'details'
                  ? 'text-foreground border-b-2 border-accent'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('details')}
              role="tab"
              aria-selected={activeTab === 'details'}
            >
              Details
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'evidence'
                  ? 'text-foreground border-b-2 border-accent'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('evidence')}
              role="tab"
              aria-selected={activeTab === 'evidence'}
            >
              Evidence
              {evidenceData && evidenceData.totalScore !== null && (
                <Badge variant="secondary" className="ml-2">
                  {evidenceData.totalScore.toFixed(1)}
                </Badge>
              )}
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'similar'
                  ? 'text-foreground border-b-2 border-accent'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('similar')}
              role="tab"
              aria-selected={activeTab === 'similar'}
            >
              Similar
              {similarData && similarData.total > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {similarData.total}
                </Badge>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <>
              {/* Document Metadata Card */}
              <Card>
                <CardHeader className="border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground">Document Information</h3>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {/* Document URL */}
                  {document.documentUrl && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">URL</span>
                      <div className="flex items-center gap-2 max-w-[60%]">
                        <a
                          href={document.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                        >
                          {document.documentUrl}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(document.documentUrl)}
                          aria-label="Copy URL"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Document Type */}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <span className="text-sm font-medium text-foreground">
                      {document.documentType || 'Unknown'}
                    </span>
                  </div>

                  {/* Category */}
                  {document.documentCategory && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Category</span>
                      <span className="text-sm font-medium text-foreground">
                        {document.documentCategory}
                      </span>
                    </div>
                  )}

                  {/* Text Length */}
                  {document.textLength && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Content Length</span>
                      <span className="text-sm font-medium text-foreground">
                        {document.textLength.toLocaleString()} characters
                      </span>
                    </div>
                  )}

                  {/* Last Crawled */}
                  {document.lastCrawledAt && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Last Crawled</span>
                      <span className="text-sm font-medium text-foreground">
                        {new Date(document.lastCrawledAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* District Info Card */}
              <Card>
                <CardHeader className="border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground">District</h3>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Name</span>
                    <span className="text-sm font-medium text-foreground">{district.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Location</span>
                    <span className="text-sm font-medium text-foreground">
                      {district.city}, {district.state}
                    </span>
                  </div>
                  {district.superintendentName && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Superintendent</span>
                      <span className="text-sm font-medium text-foreground">
                        {district.superintendentName}
                      </span>
                    </div>
                  )}
                  {district.superintendentEmail && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Email</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`mailto:${district.superintendentEmail}`}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {district.superintendentEmail}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(district.superintendentEmail!)}
                          aria-label="Copy email"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Matched Text Excerpt */}
              {excerptText && (
                <Card>
                  <CardHeader className="border-b border-border">
                    <h3 className="text-lg font-semibold text-foreground">Matched Excerpt</h3>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {isExcerptExpanded ? excerptText : truncatedExcerpt}
                    </p>
                    {excerptText.length > 500 && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setIsExcerptExpanded(!isExcerptExpanded)}
                        className="mt-2 p-0"
                      >
                        {isExcerptExpanded ? 'Show less' : 'Read more'}
                      </Button>
                    )}
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(excerptText)}
                      >
                        <Copy className="h-3 w-3 mr-2" />
                        Copy Excerpt
                      </Button>
                      {document.documentUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(document.documentUrl, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-2" />
                          View Full Document
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Evidence Tab */}
          {activeTab === 'evidence' && (
            <>
              {evidenceLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {evidenceError && (
                <Card className="bg-destructive/10 border-destructive">
                  <CardContent className="p-4">
                    <p className="text-sm text-destructive">{evidenceError}</p>
                  </CardContent>
                </Card>
              )}

              {!evidenceLoading && !evidenceError && evidenceData && (
                <>
                  {/* Total Score Overview */}
                  <Card>
                    <CardHeader className="border-b border-border">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-foreground">
                          Keyword Scores for {evidenceData.districtName}
                        </h3>
                        {evidenceData.totalScore !== null && (
                          <Badge
                            variant="default"
                            className="text-lg px-3 py-1"
                          >
                            Total: {evidenceData.totalScore.toFixed(1)}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <CategoryScoreCard
                          label="Readiness"
                          category={evidenceData.readiness}
                          color="bg-blue-500"
                        />
                        <CategoryScoreCard
                          label="Alignment"
                          category={evidenceData.alignment}
                          color="bg-green-500"
                        />
                        <CategoryScoreCard
                          label="Activation"
                          category={evidenceData.activation}
                          color="bg-purple-500"
                        />
                        <CategoryScoreCard
                          label="Branding"
                          category={evidenceData.branding}
                          color="bg-orange-500"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detailed Evidence by Category */}
                  {evidenceData.readiness && evidenceData.readiness.keywordsFound.length > 0 && (
                    <CategoryEvidenceCard
                      label="Readiness"
                      category={evidenceData.readiness}
                      color="blue"
                    />
                  )}
                  {evidenceData.alignment && evidenceData.alignment.keywordsFound.length > 0 && (
                    <CategoryEvidenceCard
                      label="Alignment"
                      category={evidenceData.alignment}
                      color="green"
                    />
                  )}
                  {evidenceData.activation && evidenceData.activation.keywordsFound.length > 0 && (
                    <CategoryEvidenceCard
                      label="Activation"
                      category={evidenceData.activation}
                      color="purple"
                    />
                  )}
                  {evidenceData.branding && evidenceData.branding.keywordsFound.length > 0 && (
                    <CategoryEvidenceCard
                      label="Branding"
                      category={evidenceData.branding}
                      color="orange"
                    />
                  )}

                  {/* No Evidence State */}
                  {(!evidenceData.readiness || evidenceData.readiness.keywordsFound.length === 0) &&
                   (!evidenceData.alignment || evidenceData.alignment.keywordsFound.length === 0) &&
                   (!evidenceData.activation || evidenceData.activation.keywordsFound.length === 0) &&
                   (!evidenceData.branding || evidenceData.branding.keywordsFound.length === 0) && (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">
                          No keyword evidence found for this district.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
          )}

          {/* Similar Tab */}
          {activeTab === 'similar' && (
            <>
              {similarLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {similarError && (
                <Card className="bg-destructive/10 border-destructive">
                  <CardContent className="p-4">
                    <p className="text-sm text-destructive">{similarError}</p>
                  </CardContent>
                </Card>
              )}

              {!similarLoading && !similarError && similarData && (
                <>
                  {similarData.results.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Found {similarData.total} similar document{similarData.total !== 1 ? 's' : ''} based on content similarity.
                      </p>
                      {similarData.results.map((similar: SimilarDocument) => (
                        <SimilarDocumentCard
                          key={similar.document.id}
                          similar={similar}
                          onClick={() => {
                            if (onDocumentSelect) {
                              onDocumentSelect(similar.document.id, similar.document, similar.district)
                            }
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">
                          No similar documents found.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// Helper component for category score display
function CategoryScoreCard({
  label,
  category,
  color,
}: {
  label: string
  category: CategoryEvidence | null
  color: string
}) {
  const score = category?.score ?? 0
  const maxScore = 10 // Assume max score of 10

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">
          {score !== null ? score.toFixed(1) : '0.0'}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min((score / maxScore) * 100, 100)}%` }}
        />
      </div>
      {category && category.keywordsFound.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {category.keywordsFound.length} keyword{category.keywordsFound.length !== 1 ? 's' : ''} found
        </p>
      )}
    </div>
  )
}

// Helper component for category evidence display
function CategoryEvidenceCard({
  label,
  category,
  color,
}: {
  label: string
  category: CategoryEvidence
  color: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/20',
    green: 'bg-green-500/10 border-green-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
    orange: 'bg-orange-500/10 border-orange-500/20',
  }

  const badgeClasses = {
    blue: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
    green: 'bg-green-500/20 text-green-700 dark:text-green-300',
    purple: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
    orange: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  }

  return (
    <Card className={colorClasses[color]}>
      <CardHeader className="border-b border-border/50 pb-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-foreground">{label}</h4>
          <span className="text-sm text-muted-foreground">
            {category.totalMentions} mention{category.totalMentions !== 1 ? 's' : ''}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Keywords Found */}
        <div className="flex flex-wrap gap-2">
          {category.keywordsFound.map((keyword, idx) => (
            <Badge key={idx} variant="secondary" className={badgeClasses[color]}>
              {keyword}
            </Badge>
          ))}
        </div>

        {/* Document Excerpts */}
        {category.documents && category.documents.length > 0 && (
          <div className="space-y-2 mt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evidence from documents:
            </p>
            {category.documents.slice(0, 3).map((doc, idx) => (
              <div key={idx} className="bg-background/50 rounded p-3 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {doc.documentType}
                  </Badge>
                </div>
                {doc.text && (
                  <p className="text-muted-foreground line-clamp-3 italic">
                    "{doc.text}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Helper component for similar document cards
function SimilarDocumentCard({
  similar,
  onClick,
}: {
  similar: SimilarDocument
  onClick: () => void
}) {
  return (
    <Card
      className="cursor-pointer hover:border-accent transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                {similar.document.documentType || 'Document'}
              </Badge>
              <Badge
                variant="outline"
                className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-xs"
              >
                {Math.round(similar.similarity * 100)}% similar
              </Badge>
            </div>
            <h4 className="font-medium text-foreground truncate">
              {similar.document.documentTitle || 'Untitled Document'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {similar.district.name}, {similar.district.state}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  )
}
