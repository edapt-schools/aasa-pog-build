import { useState, useEffect, useCallback } from 'react';
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client';
/**
 * Custom hook to fetch single district details with keyword scores
 * Returns district info, keyword scores, and document count
 */
export function useDistrictDetail(ncesId) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Memoize fetch function
    const fetchDistrictDetail = useCallback(async () => {
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
            const response = await apiClient.getDistrict(ncesId);
            setData(response);
        }
        catch (err) {
            const errorMessage = getUserFriendlyErrorMessage(err);
            setError(errorMessage);
            console.error('Failed to fetch district detail:', err);
        }
        finally {
            setLoading(false);
        }
    }, [ncesId]);
    // Fetch on mount and when ncesId changes
    useEffect(() => {
        fetchDistrictDetail();
    }, [fetchDistrictDetail]);
    return {
        data,
        loading,
        error,
        refetch: fetchDistrictDetail,
    };
}
