import { useCallback, useState } from 'react';
import { apiClient, getUserFriendlyErrorMessage } from '../lib/api-client';
export function useCommandSearch() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const run = useCallback(async (request) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.runCommand(request);
            setData(response);
        }
        catch (err) {
            setError(getUserFriendlyErrorMessage(err));
        }
        finally {
            setLoading(false);
        }
    }, []);
    return { data, loading, error, run };
}
