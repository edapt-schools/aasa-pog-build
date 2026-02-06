import { useState, useEffect, useCallback } from 'react';
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client';
/**
 * Custom hook to fetch all documents for a district
 * Returns list of documents and total count
 */
export function useDistrictDocuments(ncesId) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Memoize fetch function
    const fetchDistrictDocuments = useCallback(async () => {
        // Don't fetch if no ncesId provided
        if (!ncesId) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.getDistrictDocuments(ncesId);
            setData(response);
        }
        catch (err) {
            const errorMessage = getUserFriendlyErrorMessage(err);
            setError(errorMessage);
            console.error('Failed to fetch district documents:', err);
        }
        finally {
            setLoading(false);
        }
    }, [ncesId]);
    // Fetch on mount and when ncesId changes
    useEffect(() => {
        fetchDistrictDocuments();
    }, [fetchDistrictDocuments]);
    return {
        data,
        loading,
        error,
        refetch: fetchDistrictDocuments,
    };
}
