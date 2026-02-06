import { useState, useEffect, useCallback } from 'react'
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client'
import type { TrendingResponse } from '@aasa-platform/shared'

interface UseTrendingResult {
  data: TrendingResponse | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Custom hook to fetch trending keywords
 * Used for trending keywords visualization
 */
export function useTrending(period: '7d' | '30d' | '90d' = '30d'): UseTrendingResult {
  const [data, setData] = useState<TrendingResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTrending = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.getTrendingKeywords(period)
      setData(response)
    } catch (err) {
      const errorMessage = getUserFriendlyErrorMessage(err)
      setError(errorMessage)
      console.error('Failed to fetch trending keywords:', err)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchTrending()
  }, [fetchTrending])

  return {
    data,
    loading,
    error,
    refetch: fetchTrending,
  }
}
