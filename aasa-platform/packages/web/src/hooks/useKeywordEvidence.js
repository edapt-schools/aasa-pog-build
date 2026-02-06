import { useState, useEffect, useCallback } from 'react';
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client';
/**
 * Custom hook to fetch keyword evidence for a district
 * Shows matched keywords, scores, and document excerpts
 */
export function useKeywordEvidence(ncesId) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Memoize fetch function
    const fetchEvidence = useCallback(async () => {
        if (!ncesId) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.getKeywordEvidence(ncesId);
            setData(response);
        }
        catch (err) {
            const errorMessage = getUserFriendlyErrorMessage(err);
            setError(errorMessage);
            console.error('Failed to fetch keyword evidence:', err);
        }
        finally {
            setLoading(false);
        }
    }, [ncesId]);
    // Fetch on mount and when ncesId changes
    useEffect(() => {
        if (ncesId) {
            fetchEvidence();
        }
    }, [fetchEvidence, ncesId]);
    return {
        data,
        loading,
        error,
        refetch: fetchEvidence,
    };
}
