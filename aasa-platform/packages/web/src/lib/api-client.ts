/**
 * API Client for AASA District Intelligence Platform
 * Centralized fetch wrapper with auth credentials and type safety
 */

import { createClient } from '@supabase/supabase-js'
import type {
  CommandRequest,
  CommandResponse,
  CommandSearchTelemetrySummary,
  DistrictWhyDetails,
  ListDistrictsParams,
  ListDistrictsResponse,
  DistrictDetailResponse,
  DistrictDocumentsResponse,
  SemanticSearchParams,
  SemanticSearchResponse,
  SimilarDocumentsResponse,
  KeywordEvidenceResponse,
  InsightsOverviewResponse,
  StatesResponse,
  StateDetailResponse,
  TrendingResponse,
  APIError,
  SavedCohort,
  ListCohortsResponse,
  CohortDetailResponse,
  SavedSearchRecord,
  ListSavedSearchesResponse,
} from '@aasa-platform/shared'

// Initialize Supabase client for getting auth token
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
)

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

/**
 * Get API base URL from environment or use relative path for dev
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

/**
 * Base fetch wrapper with error handling and auth credentials
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}/api${endpoint}`

  // Get current Supabase session for Bearer token auth
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token

  const config: RequestInit = {
    ...options,
    credentials: 'include', // Keep cookies as fallback
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, config)

    // Handle non-OK responses
    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login on auth failure
        window.location.href = '/login'
        throw new ApiClientError('Authentication required', 401, 'UNAUTHORIZED')
      }

      // Try to parse error message from response
      let errorMessage = 'Request failed'
      try {
        const errorData = (await response.json()) as APIError
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch {
        // If parsing fails, use status text
        errorMessage = response.statusText || errorMessage
      }

      throw new ApiClientError(errorMessage, response.status)
    }

    // Parse and return JSON response
    return await response.json()
  } catch (error) {
    // Re-throw ApiClientError as-is
    if (error instanceof ApiClientError) {
      throw error
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new ApiClientError('Network error. Please check your connection.', 0, 'NETWORK_ERROR')
    }

    // Handle other errors
    throw new ApiClientError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      0,
      'UNKNOWN_ERROR'
    )
  }
}

/**
 * Build query string from params object
 */
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return

    if (Array.isArray(value)) {
      // Handle arrays (e.g., state[], outreachTier[])
      value.forEach((v) => searchParams.append(key, String(v)))
    } else {
      searchParams.append(key, String(value))
    }
  })

  return searchParams.toString()
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    // Return custom message for known errors
    if (error.code === 'NETWORK_ERROR') {
      return 'Unable to connect to the server. Please check your internet connection.'
    }
    if (error.code === 'UNAUTHORIZED') {
      return 'Your session has expired. Please log in again.'
    }
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred. Please try again.'
}

/**
 * API Client class with type-safe methods
 */
export class ApiClient {
  /**
   * List districts with filters and pagination
   */
  async listDistricts(params: ListDistrictsParams = {}): Promise<ListDistrictsResponse> {
    const queryString = buildQueryString(params as Record<string, unknown>)
    const endpoint = `/districts${queryString ? `?${queryString}` : ''}`
    return apiFetch<ListDistrictsResponse>(endpoint)
  }

  /**
   * Get single district details with keyword scores
   */
  async getDistrict(ncesId: string): Promise<DistrictDetailResponse> {
    return apiFetch<DistrictDetailResponse>(`/districts/${ncesId}`)
  }

  /**
   * Get all documents for a district
   */
  async getDistrictDocuments(ncesId: string): Promise<DistrictDocumentsResponse> {
    return apiFetch<DistrictDocumentsResponse>(`/districts/${ncesId}/documents`)
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(params: SemanticSearchParams): Promise<SemanticSearchResponse> {
    return apiFetch<SemanticSearchResponse>('/search/semantic', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Command-center search and action orchestration.
   */
  async runCommand(params: CommandRequest): Promise<CommandResponse> {
    return apiFetch<CommandResponse>('/search/command', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Get similar documents using vector similarity
   */
  async getSimilarDocuments(documentId: string, limit: number = 20): Promise<SimilarDocumentsResponse> {
    const queryString = buildQueryString({ limit })
    const endpoint = `/search/similar/${documentId}${queryString ? `?${queryString}` : ''}`
    return apiFetch<SimilarDocumentsResponse>(endpoint)
  }

  /**
   * Get keyword evidence for a district
   */
  async getKeywordEvidence(ncesId: string): Promise<KeywordEvidenceResponse> {
    return apiFetch<KeywordEvidenceResponse>(`/search/evidence/${ncesId}`)
  }

  /**
   * Get on-demand "why this district" payload.
   */
  async getDistrictWhyDetails(
    ncesId: string,
    confidenceThreshold: number = 0.6
  ): Promise<DistrictWhyDetails> {
    return apiFetch<DistrictWhyDetails>(
      `/search/why/${ncesId}?confidenceThreshold=${confidenceThreshold}`
    )
  }

  async getCommandTelemetry(days: number = 7): Promise<CommandSearchTelemetrySummary> {
    return apiFetch<CommandSearchTelemetrySummary>(`/search/telemetry?days=${days}`)
  }

  // =========================================================================
  // Insights API Methods
  // =========================================================================

  /**
   * Get national overview statistics
   */
  async getInsightsOverview(): Promise<InsightsOverviewResponse> {
    return apiFetch<InsightsOverviewResponse>('/insights/overview')
  }

  /**
   * Get aggregated statistics for all states
   */
  async getAllStateStats(): Promise<StatesResponse> {
    return apiFetch<StatesResponse>('/insights/states')
  }

  /**
   * Get detailed statistics for a single state
   */
  async getStateDetail(stateCode: string): Promise<StateDetailResponse> {
    return apiFetch<StateDetailResponse>(`/insights/states/${stateCode}`)
  }

  /**
   * Get trending keywords
   */
  async getTrendingKeywords(period: '7d' | '30d' | '90d' = '30d'): Promise<TrendingResponse> {
    return apiFetch<TrendingResponse>(`/insights/trending?period=${period}`)
  }

  // =========================================================================
  // Cohort API Methods
  // =========================================================================

  async listCohorts(): Promise<ListCohortsResponse> {
    return apiFetch<ListCohortsResponse>('/cohorts')
  }

  async createCohort(name: string, description?: string): Promise<SavedCohort> {
    return apiFetch<SavedCohort>('/cohorts', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
  }

  async getCohortDetail(cohortId: string): Promise<CohortDetailResponse> {
    return apiFetch<CohortDetailResponse>(`/cohorts/${cohortId}`)
  }

  async updateCohort(cohortId: string, updates: { name?: string; description?: string }): Promise<SavedCohort> {
    return apiFetch<SavedCohort>(`/cohorts/${cohortId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteCohort(cohortId: string): Promise<void> {
    await apiFetch<{ success: boolean }>(`/cohorts/${cohortId}`, { method: 'DELETE' })
  }

  async addDistrictsToCohort(cohortId: string, ncesIds: string[]): Promise<{ added: number }> {
    return apiFetch<{ added: number }>(`/cohorts/${cohortId}/districts`, {
      method: 'POST',
      body: JSON.stringify({ ncesIds }),
    })
  }

  async removeDistrictFromCohort(cohortId: string, ncesId: string): Promise<void> {
    await apiFetch<{ success: boolean }>(`/cohorts/${cohortId}/districts/${ncesId}`, { method: 'DELETE' })
  }

  // =========================================================================
  // Saved Search API Methods
  // =========================================================================

  async listSavedSearches(): Promise<ListSavedSearchesResponse> {
    return apiFetch<ListSavedSearchesResponse>('/searches')
  }

  async saveSearch(data: {
    name: string
    query: string
    intent?: string
    filters?: Record<string, unknown>
    resultCount?: number
  }): Promise<SavedSearchRecord> {
    return apiFetch<SavedSearchRecord>('/searches', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteSavedSearch(searchId: string): Promise<void> {
    await apiFetch<{ success: boolean }>(`/searches/${searchId}`, { method: 'DELETE' })
  }
}

/**
 * Singleton instance of ApiClient
 */
export const apiClient = new ApiClient()
