import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
export default function Login() {
    const { user, loading, login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const error = searchParams.get('error');
    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            navigate('/discovery');
        }
    }, [user, navigate]);
    if (loading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4" }), _jsx("p", { className: "text-muted-foreground", children: "Loading..." })] }) }));
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background px-4", children: _jsxs("div", { className: "max-w-md w-full space-y-8", children: [_jsxs("div", { className: "text-center", children: [_jsx("h1", { className: "text-heading-2 font-semibold text-foreground mb-2", children: "AASA District Intelligence" }), _jsx("p", { className: "text-body text-muted-foreground", children: "Sign in to access the district intelligence platform" })] }), error && (_jsx("div", { className: "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4", children: _jsx("p", { className: "text-sm text-red-800 dark:text-red-200", children: error === 'auth_failed'
                            ? 'Authentication failed. Please try again.'
                            : 'An error occurred during login.' }) })), _jsxs("div", { className: "bg-card rounded-lg border border-border p-8 shadow-sm space-y-3", children: [_jsxs("button", { onClick: () => login('azure'), className: "w-full flex items-center justify-center gap-3 px-6 py-3 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity font-medium", children: [_jsx("svg", { className: "w-5 h-5", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M11.4 24H0l1.2-11.4L11.4 24zm-.6-13.4L0 12.6 10.8 0v10.6zm12 1.4H12L23.4 1.2 22.8 12zM12 13.2L22.8 24H12v-10.8z" }) }), "Sign in with Microsoft"] }), _jsxs("button", { onClick: () => login('google'), className: "w-full flex items-center justify-center gap-3 px-6 py-3 bg-card text-foreground border border-border rounded-lg hover:bg-muted transition-colors font-medium", children: [_jsxs("svg", { className: "w-5 h-5", viewBox: "0 0 24 24", fill: "currentColor", children: [_jsx("path", { d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), _jsx("path", { d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), _jsx("path", { d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), _jsx("path", { d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" })] }), "Sign in with Google"] }), _jsx("p", { className: "mt-4 text-xs text-center text-muted-foreground", children: "AASA members and authorized personnel only" })] })] }) }));
}
