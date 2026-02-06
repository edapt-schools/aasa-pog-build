import { useState, useEffect, useCallback } from 'react'
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client'
import type { StatesResponse, StateDetailResponse } from '@aasa-platform/shared'

interface UseAllStateStatsResult {
  data: StatesResponse | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Custom hook to fetch aggregated statistics for all states
 * Used for map visualization and state comparison table
 */
export function useAllStateStats(): UseAllStateStatsResult {
  const [data, setData] = useState<StatesResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.getAllStateStats()
      setData(response)
    } catch (err) {
      const errorMessage = getUserFriendlyErrorMessage(err)
      setError(errorMessage)
      console.error('Failed to fetch state stats:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {
    data,
    loading,
    error,
    refetch: fetchStats,
  }
}

interface UseStateDetailResult {
  data: StateDetailResponse | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Custom hook to fetch detailed statistics for a single state
 * Used for state detail panel
 */
export function useStateDetail(stateCode: string | null): UseStateDetailResult {
  const [data, setData] = useState<StateDetailResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!stateCode) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.getStateDetail(stateCode)
      setData(response)
    } catch (err) {
      const errorMessage = getUserFriendlyErrorMessage(err)
      setError(errorMessage)
      console.error('Failed to fetch state detail:', err)
    } finally {
      setLoading(false)
    }
  }, [stateCode])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  return {
    data,
    loading,
    error,
    refetch: fetchDetail,
  }
}
