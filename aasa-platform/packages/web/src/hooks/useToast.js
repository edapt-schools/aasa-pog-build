import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback } from 'react';
const ToastContext = createContext(undefined);
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);
    const showToast = useCallback((message, type = 'info', duration = 5000) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const newToast = { id, message, type, duration };
        setToasts((prev) => [...prev, newToast]);
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);
    const success = useCallback((message) => showToast(message, 'success'), [showToast]);
    const error = useCallback((message) => showToast(message, 'error'), [showToast]);
    const warning = useCallback((message) => showToast(message, 'warning'), [showToast]);
    const info = useCallback((message) => showToast(message, 'info'), [showToast]);
    return (_jsxs(ToastContext.Provider, { value: { toasts, showToast, removeToast, success, error, warning, info }, children: [children, _jsx(ToastContainer, { toasts: toasts, onRemove: removeToast })] }));
}
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}
// Toast Container Component
function ToastContainer({ toasts, onRemove, }) {
    if (toasts.length === 0)
        return null;
    return (_jsx("div", { className: "fixed bottom-4 right-4 z-50 space-y-2 max-w-sm", children: toasts.map((toast) => (_jsx(ToastItem, { toast: toast, onRemove: onRemove }, toast.id))) }));
}
// Individual Toast Item
function ToastItem({ toast, onRemove }) {
    const bgColor = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warning: 'bg-amber-600',
        info: 'bg-blue-600',
    }[toast.type];
    return (_jsxs("div", { className: `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3 min-w-80 animate-in slide-in-from-right`, children: [_jsx("p", { className: "text-sm flex-1", children: toast.message }), _jsx("button", { onClick: () => onRemove(toast.id), className: "text-white hover:text-gray-200 transition-colors", "aria-label": "Close", children: _jsx("svg", { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z", clipRule: "evenodd" }) }) })] }));
}
