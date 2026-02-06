import { useState, useEffect, useCallback } from 'react';
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client';
/**
 * Custom hook to fetch national insights overview statistics
 * Returns total districts, superintendent coverage, document stats, and scores
 */
export function useInsightsOverview() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const fetchOverview = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.getInsightsOverview();
            setData(response);
        }
        catch (err) {
            const errorMessage = getUserFriendlyErrorMessage(err);
            setError(errorMessage);
            console.error('Failed to fetch insights overview:', err);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        fetchOverview();
    }, [fetchOverview]);
    return {
        data,
        loading,
        error,
        refetch: fetchOverview,
    };
}
