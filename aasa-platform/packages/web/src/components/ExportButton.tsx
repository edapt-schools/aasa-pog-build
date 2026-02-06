import { useState } from 'react'
import { Button } from './ui/button'
import { Download, Loader2 } from 'lucide-react'
import type { District } from '@aasa-platform/shared'

interface ExportButtonProps {
  data: District[] | District | null | undefined
  filename?: string
  label?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

type ExportFormat = 'csv' | 'json'

/**
 * Export button with CSV/JSON format support
 * Generates files client-side and triggers browser download
 */
export function ExportButton({
  data,
  filename = 'districts',
  label = 'Export',
  variant = 'outline',
  size = 'default',
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('csv')

  // Normalize data to array
  const getDataArray = (): District[] => {
    if (!data) return []
    return Array.isArray(data) ? data : [data]
  }

  // Generate CSV content
  const generateCSV = (districts: District[]): string => {
    if (districts.length === 0) return ''

    // Define CSV columns
    const columns = [
      { key: 'ncesId', label: 'NCES ID' },
      { key: 'name', label: 'District Name' },
      { key: 'state', label: 'State' },
      { key: 'county', label: 'County' },
      { key: 'city', label: 'City' },
      { key: 'enrollment', label: 'Enrollment' },
      { key: 'gradesServed', label: 'Grades Served' },
      { key: 'superintendentName', label: 'Superintendent' },
      { key: 'superintendentEmail', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'websiteDomain', label: 'Website' },
      { key: 'frplPercent', label: 'FRPL %' },
      { key: 'minorityPercent', label: 'Minority %' },
      { key: 'localeCode', label: 'Locale' },
      { key: 'outreachTier', label: 'Tier' },
    ]

    // Generate header row
    const header = columns.map((col) => col.label).join(',')

    // Generate data rows
    const rows = districts.map((district) => {
      return columns
        .map((col) => {
          const value = district[col.key as keyof District]

          // Handle null/undefined
          if (value === null || value === undefined) return ''

          // Convert to string and escape quotes
          const stringValue = String(value)

          // Wrap in quotes if contains comma, newline, or quote
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }

          return stringValue
        })
        .join(',')
    })

    return [header, ...rows].join('\n')
  }

  // Generate JSON content
  const generateJSON = (districts: District[]): string => {
    return JSON.stringify(districts, null, 2)
  }

  // Trigger browser download
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Handle export
  const handleExport = async () => {
    const districts = getDataArray()

    if (districts.length === 0) {
      // TODO: Show toast notification
      console.warn('No data to export')
      return
    }

    setIsExporting(true)

    try {
      // Generate content based on format
      let content: string
      let extension: string
      let mimeType: string

      if (format === 'csv') {
        content = generateCSV(districts)
        extension = 'csv'
        mimeType = 'text/csv;charset=utf-8;'
      } else {
        content = generateJSON(districts)
        extension = 'json'
        mimeType = 'application/json'
      }

      // Add timestamp to filename
      const timestamp = new Date().toISOString().split('T')[0]
      const fullFilename = `${filename}_${timestamp}.${extension}`

      // Trigger download
      downloadFile(content, fullFilename, mimeType)

      // TODO: Show success toast
      console.log(`Exported ${districts.length} district${districts.length === 1 ? '' : 's'}`)
    } catch (error) {
      console.error('Export failed:', error)
      // TODO: Show error toast
    } finally {
      setIsExporting(false)
    }
  }

  const districts = getDataArray()
  const isDisabled = districts.length === 0 || isExporting

  return (
    <div className="flex items-center gap-2">
      {/* Format selector */}
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as ExportFormat)}
        disabled={isExporting}
        className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm disabled:opacity-50"
        aria-label="Export format"
      >
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
      </select>

      {/* Export button */}
      <Button
        variant={variant}
        size={size}
        onClick={handleExport}
        disabled={isDisabled}
        aria-label={`Export ${districts.length} district${districts.length === 1 ? '' : 's'} as ${format.toUpperCase()}`}
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            {label} {districts.length > 0 && `(${districts.length})`}
          </>
        )}
      </Button>
    </div>
  )
}
