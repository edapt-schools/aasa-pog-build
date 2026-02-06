import { useState, useEffect, useCallback } from 'react';
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client';
/**
 * Custom hook to fetch similar documents using vector similarity
 * Finds documents with similar content to the source document
 */
export function useSimilarDocuments(documentId, limit = 20) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Memoize fetch function
    const fetchSimilarDocuments = useCallback(async () => {
        if (!documentId) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.getSimilarDocuments(documentId, limit);
            setData(response);
        }
        catch (err) {
            const errorMessage = getUserFriendlyErrorMessage(err);
            setError(errorMessage);
            console.error('Failed to fetch similar documents:', err);
        }
        finally {
            setLoading(false);
        }
    }, [documentId, limit]);
    // Fetch on mount and when documentId or limit changes
    useEffect(() => {
        if (documentId) {
            fetchSimilarDocuments();
        }
    }, [fetchSimilarDocuments, documentId]);
    return {
        data,
        loading,
        error,
        refetch: fetchSimilarDocuments,
    };
}
