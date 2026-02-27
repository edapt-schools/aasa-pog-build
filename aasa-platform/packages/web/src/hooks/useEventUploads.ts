import { useState, useEffect, useCallback } from 'react'
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client'
import type {
  ListEventUploadsResponse,
  EventUploadDetailResponse,
  EventUploadResponse,
} from '@aasa-platform/shared'

/**
 * Hook to list all event uploads for the current user
 */
export function useEventUploads() {
  const [data, setData] = useState<ListEventUploadsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.listEventUploads()
      setData(response)
    } catch (err) {
      setError(getUserFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

/**
 * Hook to get a single upload's detail and results
 */
export function useEventUploadDetail(uploadId: string | null) {
  const [data, setData] = useState<EventUploadDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!uploadId) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.getEventUploadDetail(uploadId)
      setData(response)
    } catch (err) {
      setError(getUserFriendlyErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [uploadId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

/**
 * Hook to handle the upload action
 */
export function useUploadEventList() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EventUploadResponse | null>(null)

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const text = await file.text()
      const response = await apiClient.uploadEventList(file.name, text)
      setResult(response)
      return response
    } catch (err) {
      const msg = getUserFriendlyErrorMessage(err)
      setError(msg)
      throw err
    } finally {
      setUploading(false)
    }
  }, [])

  return { upload, uploading, error, result }
}
