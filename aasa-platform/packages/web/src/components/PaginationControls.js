import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ChevronLeft, ChevronRight } from 'lucide-react';
export function PaginationControls({ total, limit, offset, onPageChange, onLimitChange, }) {
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    const handlePrevious = () => {
        if (currentPage > 1) {
            onPageChange((currentPage - 2) * limit);
        }
    };
    const handleNext = () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage * limit);
        }
    };
    const handleJumpToPage = (page) => {
        const validPage = Math.max(1, Math.min(page, totalPages));
        onPageChange((validPage - 1) * limit);
    };
    // Keyboard navigation (arrow keys)
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only trigger if no input is focused
            if (document.activeElement?.tagName === 'INPUT')
                return;
            if (e.key === 'ArrowLeft' && currentPage > 1) {
                e.preventDefault();
                handlePrevious();
            }
            else if (e.key === 'ArrowRight' && currentPage < totalPages) {
                e.preventDefault();
                handleNext();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, totalPages]);
    if (total === 0)
        return null;
    return (_jsxs("div", { className: "flex items-center justify-between gap-4 py-4 border-t border-border", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Results per page:" }), _jsxs("select", { value: limit, onChange: (e) => onLimitChange(parseInt(e.target.value)), className: "px-3 py-1 border border-border rounded-md bg-background text-foreground text-sm", children: [_jsx("option", { value: 25, children: "25" }), _jsx("option", { value: 50, children: "50" }), _jsx("option", { value: 100, children: "100" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: handlePrevious, disabled: currentPage === 1, "aria-label": "Previous page", children: _jsx(ChevronLeft, { className: "h-4 w-4" }) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Page" }), _jsx(Input, { type: "number", min: 1, max: totalPages, value: currentPage, onChange: (e) => {
                                    const page = parseInt(e.target.value);
                                    if (page && page >= 1 && page <= totalPages) {
                                        handleJumpToPage(page);
                                    }
                                }, className: "w-16 text-center", "aria-label": "Current page" }), _jsxs("span", { className: "text-sm text-muted-foreground", children: ["of ", totalPages.toLocaleString()] })] }), _jsx(Button, { variant: "outline", size: "sm", onClick: handleNext, disabled: currentPage === totalPages, "aria-label": "Next page", children: _jsx(ChevronRight, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "text-xs text-muted-foreground hidden lg:block", children: "Use \u2190 \u2192 keys to navigate" })] }));
}
