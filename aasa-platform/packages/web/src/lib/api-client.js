/**
 * API Client for AASA District Intelligence Platform
 * Centralized fetch wrapper with auth credentials and type safety
 */
/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
    status;
    code;
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'ApiClientError';
    }
}
/**
 * Base fetch wrapper with error handling and auth credentials
 */
async function apiFetch(endpoint, options = {}) {
    const url = `/api${endpoint}`;
    const config = {
        ...options,
        credentials: 'include', // Include auth cookies
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    };
    try {
        const response = await fetch(url, config);
        // Handle non-OK responses
        if (!response.ok) {
            if (response.status === 401) {
                // Redirect to login on auth failure
                window.location.href = '/login';
                throw new ApiClientError('Authentication required', 401, 'UNAUTHORIZED');
            }
            // Try to parse error message from response
            let errorMessage = 'Request failed';
            try {
                const errorData = (await response.json());
                errorMessage = errorData.message || errorData.error || errorMessage;
            }
            catch {
                // If parsing fails, use status text
                errorMessage = response.statusText || errorMessage;
            }
            throw new ApiClientError(errorMessage, response.status);
        }
        // Parse and return JSON response
        return await response.json();
    }
    catch (error) {
        // Re-throw ApiClientError as-is
        if (error instanceof ApiClientError) {
            throw error;
        }
        // Handle network errors
        if (error instanceof TypeError) {
            throw new ApiClientError('Network error. Please check your connection.', 0, 'NETWORK_ERROR');
        }
        // Handle other errors
        throw new ApiClientError(error instanceof Error ? error.message : 'An unexpected error occurred', 0, 'UNKNOWN_ERROR');
    }
}
/**
 * Build query string from params object
 */
function buildQueryString(params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null)
            return;
        if (Array.isArray(value)) {
            // Handle arrays (e.g., state[], outreachTier[])
            value.forEach((v) => searchParams.append(key, String(v)));
        }
        else {
            searchParams.append(key, String(value));
        }
    });
    return searchParams.toString();
}
/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error) {
    if (error instanceof ApiClientError) {
        // Return custom message for known errors
        if (error.code === 'NETWORK_ERROR') {
            return 'Unable to connect to the server. Please check your internet connection.';
        }
        if (error.code === 'UNAUTHORIZED') {
            return 'Your session has expired. Please log in again.';
        }
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred. Please try again.';
}
/**
 * API Client class with type-safe methods
 */
export class ApiClient {
    /**
     * List districts with filters and pagination
     */
    async listDistricts(params = {}) {
        const queryString = buildQueryString(params);
        const endpoint = `/districts${queryString ? `?${queryString}` : ''}`;
        return apiFetch(endpoint);
    }
    /**
     * Get single district details with keyword scores
     */
    async getDistrict(ncesId) {
        return apiFetch(`/districts/${ncesId}`);
    }
    /**
     * Get all documents for a district
     */
    async getDistrictDocuments(ncesId) {
        return apiFetch(`/districts/${ncesId}/documents`);
    }
    /**
     * Semantic search using vector similarity
     */
    async semanticSearch(params) {
        return apiFetch('/search/semantic', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
    /**
     * Get similar documents using vector similarity
     */
    async getSimilarDocuments(documentId, limit = 20) {
        const queryString = buildQueryString({ limit });
        const endpoint = `/search/similar/${documentId}${queryString ? `?${queryString}` : ''}`;
        return apiFetch(endpoint);
    }
    /**
     * Get keyword evidence for a district
     */
    async getKeywordEvidence(ncesId) {
        return apiFetch(`/search/evidence/${ncesId}`);
    }
    // =========================================================================
    // Insights API Methods
    // =========================================================================
    /**
     * Get national overview statistics
     */
    async getInsightsOverview() {
        return apiFetch('/insights/overview');
    }
    /**
     * Get aggregated statistics for all states
     */
    async getAllStateStats() {
        return apiFetch('/insights/states');
    }
    /**
     * Get detailed statistics for a single state
     */
    async getStateDetail(stateCode) {
        return apiFetch(`/insights/states/${stateCode}`);
    }
    /**
     * Get trending keywords
     */
    async getTrendingKeywords(period = '30d') {
        return apiFetch(`/insights/trending?period=${period}`);
    }
}
/**
 * Singleton instance of ApiClient
 */
export const apiClient = new ApiClient();
