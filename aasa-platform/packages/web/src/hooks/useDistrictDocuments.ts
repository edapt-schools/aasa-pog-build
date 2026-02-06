import { useState, useEffect, useCallback } from 'react'
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client'
import type { DistrictDocumentsResponse } from '@aasa-platform/shared'

interface UseDistrictDocumentsResult {
  data: DistrictDocumentsResponse | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Custom hook to fetch all documents for a district
 * Returns list of documents and total count
 */
export function useDistrictDocuments(ncesId: string | null): UseDistrictDocumentsResult {
  const [data, setData] = useState<DistrictDocumentsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Memoize fetch function
  const fetchDistrictDocuments = useCallback(async () => {
    // Don't fetch if no ncesId provided
    if (!ncesId) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.getDistrictDocuments(ncesId)
      setData(response)
    } catch (err) {
      const errorMessage = getUserFriendlyErrorMessage(err)
      setError(errorMessage)
      console.error('Failed to fetch district documents:', err)
    } finally {
      setLoading(false)
    }
  }, [ncesId])

  // Fetch on mount and when ncesId changes
  useEffect(() => {
    fetchDistrictDocuments()
  }, [fetchDistrictDocuments])

  return {
    data,
    loading,
    error,
    refetch: fetchDistrictDocuments,
  }
}
