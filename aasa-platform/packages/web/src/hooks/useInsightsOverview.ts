import { useState, useEffect, useCallback } from 'react'
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client'
import type { InsightsOverviewResponse } from '@aasa-platform/shared'

interface UseInsightsOverviewResult {
  data: InsightsOverviewResponse | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Custom hook to fetch national insights overview statistics
 * Returns total districts, superintendent coverage, document stats, and scores
 */
export function useInsightsOverview(): UseInsightsOverviewResult {
  const [data, setData] = useState<InsightsOverviewResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.getInsightsOverview()
      setData(response)
    } catch (err) {
      const errorMessage = getUserFriendlyErrorMessage(err)
      setError(errorMessage)
      console.error('Failed to fetch insights overview:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  return {
    data,
    loading,
    error,
    refetch: fetchOverview,
  }
}
