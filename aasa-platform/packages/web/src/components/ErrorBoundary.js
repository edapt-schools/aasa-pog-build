import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import { Button } from './ui/button';
import { Card, CardHeader, CardContent } from './ui/card';
/**
 * Error Boundary Component
 * Catches React errors and displays a user-friendly fallback UI
 */
export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }
    componentDidCatch(error, errorInfo) {
        // Log error to console in development
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });
        // TODO: Send to error tracking service (Sentry, Datadog, etc.)
        // logErrorToService(error, errorInfo)
    }
    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };
    render() {
        if (this.state.hasError) {
            // Custom fallback UI if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }
            // Default error UI
            return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background p-4", children: _jsxs(Card, { className: "max-w-lg w-full", children: [_jsx(CardHeader, { className: "border-b border-border p-6", children: _jsx("h2", { className: "text-2xl font-semibold text-foreground", children: "Something went wrong" }) }), _jsxs(CardContent, { className: "p-6 space-y-4", children: [_jsx("p", { className: "text-muted-foreground", children: "We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists." }), process.env.NODE_ENV === 'development' && this.state.error && (_jsxs("details", { className: "mt-4 p-4 bg-muted rounded-md", children: [_jsx("summary", { className: "font-medium text-sm cursor-pointer mb-2", children: "Error Details (Development Only)" }), _jsxs("pre", { className: "text-xs overflow-auto max-h-48 text-foreground", children: [this.state.error.toString(), this.state.errorInfo?.componentStack] })] })), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: this.handleReset, children: "Try Again" }), _jsx(Button, { variant: "outline", onClick: () => (window.location.href = '/'), children: "Go Home" })] })] })] }) }));
        }
        return this.props.children;
    }
}
