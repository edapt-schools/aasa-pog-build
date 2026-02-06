import { useState, useEffect, useCallback } from 'react';
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client';
/**
 * Custom hook to fetch district list with filters and pagination
 * Automatically refetches when params change
 */
export function useDistricts(params) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Memoize fetch function to use in useEffect and expose as refetch
    const fetchDistricts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.listDistricts(params);
            setData(response);
        }
        catch (err) {
            const errorMessage = getUserFriendlyErrorMessage(err);
            setError(errorMessage);
            console.error('Failed to fetch districts:', err);
        }
        finally {
            setLoading(false);
        }
    }, [params]);
    // Fetch on mount and when params change
    useEffect(() => {
        fetchDistricts();
    }, [fetchDistricts]);
    return {
        data,
        loading,
        error,
        refetch: fetchDistricts,
    };
}
