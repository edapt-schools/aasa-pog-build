import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppLayout } from './components/layout/AppLayout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Discovery from './pages/Discovery';
import Grants from './pages/Grants';
import Insights from './pages/Insights';
/**
 * Protected Route Component
 * Redirects to login if not authenticated
 */
function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-foreground" }) }));
    }
    if (!user) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
export const router = createBrowserRouter([
    {
        path: '/',
        element: _jsx(Navigate, { to: "/discovery", replace: true }),
    },
    {
        path: '/login',
        element: _jsx(Login, {}),
    },
    {
        path: '/auth/callback',
        element: _jsx(AuthCallback, {}),
    },
    {
        element: (_jsx(ProtectedRoute, { children: _jsx(AppLayout, {}) })),
        children: [
            {
                path: '/discovery',
                element: _jsx(Discovery, {}),
            },
            {
                path: '/grants',
                element: _jsx(Grants, {}),
            },
            {
                path: '/insights',
                element: _jsx(Insights, {}),
            },
        ],
    },
    {
        path: '*',
        element: (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background", children: _jsxs("div", { className: "text-center", children: [_jsx("h1", { className: "text-heading-1 font-semibold text-foreground mb-2", children: "404" }), _jsx("p", { className: "text-muted-foreground mb-4", children: "Page not found" }), _jsx("a", { href: "/", className: "text-accent underline", children: "Go home" })] }) })),
    },
]);
