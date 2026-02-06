import { useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationControlsProps {
  total: number
  limit: number
  offset: number
  onPageChange: (newOffset: number) => void
  onLimitChange: (newLimit: number) => void
}

export function PaginationControls({
  total,
  limit,
  offset,
  onPageChange,
  onLimitChange,
}: PaginationControlsProps) {
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange((currentPage - 2) * limit)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage * limit)
    }
  }

  const handleJumpToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    onPageChange((validPage - 1) * limit)
  }

  // Keyboard navigation (arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if no input is focused
      if (document.activeElement?.tagName === 'INPUT') return

      if (e.key === 'ArrowLeft' && currentPage > 1) {
        e.preventDefault()
        handlePrevious()
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        e.preventDefault()
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages])

  if (total === 0) return null

  return (
    <div className="flex items-center justify-between gap-4 py-4 border-t border-border">
      {/* Results per page selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Results per page:</span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(parseInt(e.target.value))}
          className="px-3 py-1 border border-border rounded-md bg-background text-foreground text-sm"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-2">
        {/* Previous button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page indicator */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Page</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const page = parseInt(e.target.value)
              if (page && page >= 1 && page <= totalPages) {
                handleJumpToPage(page)
              }
            }}
            className="w-16 text-center"
            aria-label="Current page"
          />
          <span className="text-sm text-muted-foreground">of {totalPages.toLocaleString()}</span>
        </div>

        {/* Next button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Keyboard hint */}
      <div className="text-xs text-muted-foreground hidden lg:block">
        Use ← → keys to navigate
      </div>
    </div>
  )
}
