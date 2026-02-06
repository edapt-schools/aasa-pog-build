import { useState, useEffect, useCallback } from 'react';
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client';
/**
 * Custom hook to fetch aggregated statistics for all states
 * Used for map visualization and state comparison table
 */
export function useAllStateStats() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.getAllStateStats();
            setData(response);
        }
        catch (err) {
            const errorMessage = getUserFriendlyErrorMessage(err);
            setError(errorMessage);
            console.error('Failed to fetch state stats:', err);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);
    return {
        data,
        loading,
        error,
        refetch: fetchStats,
    };
}
/**
 * Custom hook to fetch detailed statistics for a single state
 * Used for state detail panel
 */
export function useStateDetail(stateCode) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const fetchDetail = useCallback(async () => {
        if (!stateCode) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.getStateDetail(stateCode);
            setData(response);
        }
        catch (err) {
            const errorMessage = getUserFriendlyErrorMessage(err);
            setError(errorMessage);
            console.error('Failed to fetch state detail:', err);
        }
        finally {
            setLoading(false);
        }
    }, [stateCode]);
    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);
    return {
        data,
        loading,
        error,
        refetch: fetchDetail,
    };
}
