import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
export default function AuthCallback() {
    const { checkAuth } = useAuth();
    const navigate = useNavigate();
    useEffect(() => {
        // Check authentication after OAuth redirect
        const handleCallback = async () => {
            // Wait a moment for session to be established
            await new Promise((resolve) => setTimeout(resolve, 500));
            // Check if authenticated
            await checkAuth();
            // Redirect to discovery page
            navigate('/discovery');
        };
        handleCallback();
    }, [checkAuth, navigate]);
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4" }), _jsx("p", { className: "text-muted-foreground", children: "Completing sign in..." })] }) }));
}
