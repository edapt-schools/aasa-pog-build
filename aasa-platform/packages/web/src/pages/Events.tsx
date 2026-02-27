import { useState, useCallback, useRef } from 'react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  Upload,
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpDown,
  ChevronRight,
} from 'lucide-react'
import { useEventUploads, useEventUploadDetail, useUploadEventList } from '../hooks/useEventUploads'
import { apiClient } from '../lib/api-client'
import type { EventUploadResultRow } from '@aasa-platform/shared'

type SortField = 'inputName' | 'matchConfidence' | 'districtScore'
type SortDirection = 'asc' | 'desc'

export default function Events() {
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('districtScore')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: uploadsData, loading: uploadsLoading, refetch: refetchUploads } = useEventUploads()
  const { data: detailData, loading: detailLoading } = useEventUploadDetail(selectedUploadId)
  const { upload, uploading, error: uploadError } = useUploadEventList()

  // Handle file selection (from input or drag-and-drop)
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file')
      return
    }
    try {
      const result = await upload(file)
      if (result) {
        setSelectedUploadId(result.uploadId)
        refetchUploads()
      }
    } catch {
      // Error already handled in hook
    }
  }, [upload, refetchUploads])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so the same file can be re-uploaded
    e.target.value = ''
  }, [handleFile])

  // Export handler
  const handleExport = useCallback(async () => {
    if (!selectedUploadId) return
    try {
      const blob = await apiClient.exportEventUpload(selectedUploadId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `event-results_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }, [selectedUploadId])

  // Sorting
  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField])

  const sortedResults = detailData?.results
    ? [...detailData.results].sort((a, b) => {
        let aVal: number
        let bVal: number

        switch (sortField) {
          case 'inputName':
            return sortDirection === 'asc'
              ? a.inputName.localeCompare(b.inputName)
              : b.inputName.localeCompare(a.inputName)
          case 'matchConfidence':
            aVal = a.matchConfidence ? parseFloat(a.matchConfidence) : 0
            bVal = b.matchConfidence ? parseFloat(b.matchConfidence) : 0
            break
          case 'districtScore':
            aVal = a.districtScore ? parseFloat(a.districtScore) : 0
            bVal = b.districtScore ? parseFloat(b.districtScore) : 0
            break
          default:
            return 0
        }

        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      })
    : []

  return (
    <div className="min-h-full bg-background">
      {/* Page header */}
      <div className="bg-background px-4 sm:px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-lg font-semibold text-foreground leading-tight">Events</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload conference attendee lists to match and rank districts
            </p>
          </div>
          {selectedUploadId && detailData && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      <div className="flex max-w-7xl mx-auto">
        {/* Left: Upload zone + history */}
        <aside className="w-[320px] shrink-0 border-r border-border p-4 sm:p-6 space-y-6 h-[calc(100vh-104px)] overflow-y-auto">
          {/* Upload zone */}
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">Upload List</h2>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                transition-colors duration-[var(--motion-fast)]
                ${isDragOver
                  ? 'border-accent bg-accent/5'
                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
                }
                ${uploading ? 'pointer-events-none opacity-60' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 text-accent animate-spin" />
                  <p className="text-sm text-muted-foreground">Processing upload...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-foreground font-medium">
                    Drop CSV here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expects a column named "District Name" or similar
                  </p>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{uploadError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Upload history */}
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3">Upload History</h2>
            {uploadsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !uploadsData?.uploads.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No uploads yet. Upload a CSV to get started.
              </p>
            ) : (
              <div className="space-y-1">
                {uploadsData.uploads.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUploadId(u.id)}
                    className={`
                      w-full text-left px-3 py-2.5 rounded-md transition-colors text-sm
                      flex items-center gap-3
                      ${selectedUploadId === u.id
                        ? 'bg-accent/10 text-accent'
                        : 'text-foreground hover:bg-muted/50'
                      }
                    `}
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{u.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.matchedCount}/{u.rowCount} matched
                        {' \u00b7 '}
                        {new Date(u.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusIcon status={u.status} />
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right: Results table */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto h-[calc(100vh-104px)]">
          {!selectedUploadId ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-foreground font-medium mb-1">No upload selected</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Upload a CSV of conference or event attendees to match them against our
                district intelligence database.
              </p>
            </div>
          ) : detailLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : detailData ? (
            <div>
              {/* Summary bar */}
              <div className="flex items-center gap-4 mb-4 p-3 bg-card rounded-lg border border-border">
                <div className="text-sm">
                  <span className="font-medium text-foreground">{detailData.upload.fileName}</span>
                </div>
                <Badge variant="secondary">
                  {detailData.upload.rowCount} rows
                </Badge>
                <Badge variant="secondary">
                  {detailData.upload.matchedCount} matched
                </Badge>
                <Badge variant={
                  detailData.upload.matchedCount / detailData.upload.rowCount >= 0.8
                    ? 'default'
                    : 'secondary'
                }>
                  {Math.round((detailData.upload.matchedCount / detailData.upload.rowCount) * 100)}% match rate
                </Badge>
              </div>

              {/* Results table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                          <button
                            onClick={() => toggleSort('inputName')}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            Input Name
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                          Matched District
                        </th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                          State
                        </th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                          <button
                            onClick={() => toggleSort('matchConfidence')}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            Confidence
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                          <button
                            onClick={() => toggleSort('districtScore')}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            Score
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                          Tier
                        </th>
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                          Superintendent
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedResults.map((row) => (
                        <ResultRow key={row.id} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}

function ResultRow({ row }: { row: EventUploadResultRow }) {
  const confidence = row.matchConfidence ? parseFloat(row.matchConfidence) : 0
  const score = row.districtScore ? parseFloat(row.districtScore) : null

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3 text-foreground">
        <div className="max-w-[200px] truncate" title={row.inputName}>
          {row.inputName}
        </div>
        {row.inputState && (
          <span className="text-xs text-muted-foreground">{row.inputState}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.district ? (
          <div className="max-w-[200px] truncate text-foreground" title={row.district.name}>
            {row.district.name}
          </div>
        ) : (
          <span className="text-muted-foreground italic">No match</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {row.district?.state || row.inputState || ''}
      </td>
      <td className="px-4 py-3">
        {row.matchConfidence ? (
          <ConfidenceBar value={confidence} />
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        {score !== null ? (
          <span className="text-foreground font-medium">{score.toFixed(1)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.districtTier ? (
          <TierBadge tier={row.districtTier} />
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.district?.superintendentName ? (
          <div>
            <div className="text-foreground text-xs">{row.district.superintendentName}</div>
            {row.district.superintendentEmail && (
              <a
                href={`mailto:${row.district.superintendentEmail}`}
                className="text-xs text-accent hover:underline"
              >
                {row.district.superintendentEmail}
              </a>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
    </tr>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color =
    value >= 0.9 ? 'bg-green-500' :
    value >= 0.7 ? 'bg-yellow-500' :
    value >= 0.5 ? 'bg-orange-500' :
    'bg-red-500'

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8">{pct}%</span>
    </div>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const label = tier === 'tier1' ? 'Tier 1' : tier === 'tier2' ? 'Tier 2' : 'Tier 3'
  const variant = tier === 'tier1' ? 'default' : 'secondary'

  return <Badge variant={variant}>{label}</Badge>
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
    case 'processing':
      return <Loader2 className="h-3.5 w-3.5 text-accent animate-spin shrink-0" />
    default:
      return null
  }
}
