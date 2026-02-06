import { useState, useEffect, useRef } from 'react'
import { X, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Card, CardHeader, CardContent } from './ui/card'
import { KeywordScoreCard } from './KeywordScoreCard'
import { DocumentList } from './DocumentList'
import { useDistrictDetail } from '../hooks/useDistrictDetail'
import { useDistrictDocuments } from '../hooks/useDistrictDocuments'

interface DistrictDetailPanelProps {
  ncesId: string
  onClose: () => void
}

type TabType = 'overview' | 'documents'

export function DistrictDetailPanel({ ncesId, onClose }: DistrictDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const panelRef = useRef<HTMLDivElement>(null)

  const { data: detailData, loading: detailLoading, error: detailError } = useDistrictDetail(ncesId)
  const { data: documentsData, loading: docsLoading, error: docsError } = useDistrictDocuments(ncesId)

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
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

  const district = detailData?.district
  const keywordScores = detailData?.keywordScores
  const documents = documentsData?.data || []

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
        aria-labelledby="panel-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex-1 min-w-0">
              {detailLoading ? (
                <div className="h-6 w-48 bg-muted rounded animate-pulse" />
              ) : (
                <h2 id="panel-title" className="text-xl font-semibold text-foreground truncate">
                  {district?.name}
                </h2>
              )}
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
                activeTab === 'overview'
                  ? 'text-foreground border-b-2 border-accent'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('overview')}
              role="tab"
              aria-selected={activeTab === 'overview'}
            >
              Overview
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'documents'
                  ? 'text-foreground border-b-2 border-accent'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('documents')}
              role="tab"
              aria-selected={activeTab === 'documents'}
            >
              Documents
              {documentsData && documentsData.total > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {documentsData.total}
                </Badge>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Loading state */}
          {detailLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error state */}
          {detailError && (
            <Card className="bg-destructive/10 border-destructive">
              <CardContent className="p-4">
                <p className="text-sm text-destructive">{detailError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="mt-3"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && district && (
            <>
              {/* District Info Card */}
              <Card>
                <CardHeader className="border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground">District Information</h3>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {/* Location */}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Location</span>
                    <span className="text-sm font-medium text-foreground">
                      {district.city}, {district.state} {district.county && `(${district.county})`}
                    </span>
                  </div>

                  {/* NCES ID */}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">NCES ID</span>
                    <span className="text-sm font-medium text-foreground font-mono">
                      {district.ncesId}
                    </span>
                  </div>

                  {/* Enrollment */}
                  {district.enrollment && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Enrollment</span>
                      <span className="text-sm font-medium text-foreground">
                        {district.enrollment.toLocaleString()} students
                      </span>
                    </div>
                  )}

                  {/* Grades */}
                  {district.gradesServed && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Grades Served</span>
                      <span className="text-sm font-medium text-foreground">
                        {district.gradesServed}
                      </span>
                    </div>
                  )}

                  {/* FRPL */}
                  {district.frplPercent && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">FRPL %</span>
                      <span className="text-sm font-medium text-foreground">
                        {parseFloat(district.frplPercent).toFixed(1)}%
                      </span>
                    </div>
                  )}

                  {/* Minority */}
                  {district.minorityPercent && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Minority %</span>
                      <span className="text-sm font-medium text-foreground">
                        {parseFloat(district.minorityPercent).toFixed(1)}%
                      </span>
                    </div>
                  )}

                  {/* Locale Code */}
                  {district.localeCode && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Locale</span>
                      <span className="text-sm font-medium text-foreground">
                        {district.localeCode}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Superintendent Contact */}
              {(district.superintendentName || district.superintendentEmail || district.phone) && (
                <Card>
                  <CardHeader className="border-b border-border">
                    <h3 className="text-lg font-semibold text-foreground">
                      Superintendent Contact
                    </h3>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {district.superintendentName && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Name</span>
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

                    {district.phone && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Phone</span>
                        <a
                          href={`tel:${district.phone}`}
                          className="text-sm text-foreground hover:underline"
                        >
                          {district.phone}
                        </a>
                      </div>
                    )}

                    {district.address && (
                      <div className="flex justify-between items-start">
                        <span className="text-sm text-muted-foreground">Address</span>
                        <span className="text-sm text-foreground text-right max-w-xs">
                          {district.address}
                        </span>
                      </div>
                    )}

                    {district.websiteDomain && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Website</span>
                        <a
                          href={`https://${district.websiteDomain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          {district.websiteDomain}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Keyword Scores */}
              {keywordScores && (
                <KeywordScoreCard scores={keywordScores} showDetails={true} />
              )}
            </>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <>
              {docsLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {docsError && (
                <Card className="bg-destructive/10 border-destructive">
                  <CardContent className="p-4">
                    <p className="text-sm text-destructive">{docsError}</p>
                  </CardContent>
                </Card>
              )}

              {!docsLoading && !docsError && <DocumentList documents={documents} />}
            </>
          )}
        </div>
      </div>
    </>
  )
}
