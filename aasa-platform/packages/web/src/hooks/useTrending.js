import { useState, useEffect, useCallback } from 'react';
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client';
/**
 * Custom hook to fetch trending keywords
 * Used for trending keywords visualization
 */
export function useTrending(period = '30d') {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const fetchTrending = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.getTrendingKeywords(period);
            setData(response);
        }
        catch (err) {
            const errorMessage = getUserFriendlyErrorMessage(err);
            setError(errorMessage);
            console.error('Failed to fetch trending keywords:', err);
        }
        finally {
            setLoading(false);
        }
    }, [period]);
    useEffect(() => {
        fetchTrending();
    }, [fetchTrending]);
    return {
        data,
        loading,
        error,
        refetch: fetchTrending,
    };
}
