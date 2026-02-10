import { useCallback, useState } from 'react'
import type { CommandRequest, CommandResponse } from '@aasa-platform/shared'
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client'

interface UseCommandSearchResult {
  data: CommandResponse | null
  loading: boolean
  error: string | null
  run: (request: CommandRequest) => Promise<void>
}

export function useCommandSearch(): UseCommandSearchResult {
  const [data, setData] = useState<CommandResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (request: CommandRequest) => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.runCommand(request)
      setData(response)
    } catch (err) {
      setError(getUserFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, run }
}

