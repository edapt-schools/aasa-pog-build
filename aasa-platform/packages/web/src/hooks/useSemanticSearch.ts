import { useState, useEffect, useCallback } from 'react'
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client'
import type { SemanticSearchParams, SemanticSearchResponse } from '@aasa-platform/shared'

interface UseSemanticSearchResult {
  data: SemanticSearchResponse | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Custom hook for semantic search across documents
 * Automatically refetches when query or params change
 *
 * Note: Does not auto-fetch on mount - only refetches when explicitly called or params change
 */
export function useSemanticSearch(params: SemanticSearchParams | null): UseSemanticSearchResult {
  const [data, setData] = useState<SemanticSearchResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Memoize fetch function
  const fetchResults = useCallback(async () => {
    if (!params || !params.query.trim()) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.semanticSearch(params)
      setData(response)
    } catch (err) {
      const errorMessage = getUserFriendlyErrorMessage(err)
      setError(errorMessage)
      console.error('Semantic search failed:', err)
    } finally {
      setLoading(false)
    }
  }, [params])

  // Fetch when params change (but only if query is not empty)
  useEffect(() => {
    if (params && params.query.trim()) {
      fetchResults()
    }
  }, [fetchResults, params])

  return {
    data,
    loading,
    error,
    refetch: fetchResults,
  }
}
