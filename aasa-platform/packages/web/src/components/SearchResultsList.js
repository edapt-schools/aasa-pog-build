import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DocumentCard } from './DocumentCard';
import { EmptyState } from './EmptyState';
import { Loader2 } from 'lucide-react';
/**
 * Search results grid with loading and empty states
 * Displays documents in a responsive grid layout
 */
export function SearchResultsList({ results, loading, onDocumentClick, error, }) {
    // Loading state
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center py-12", children: _jsxs("div", { className: "text-center", children: [_jsx(Loader2, { className: "h-8 w-8 animate-spin text-accent mx-auto mb-4" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Searching documents..." })] }) }));
    }
    // Error state
    if (error) {
        return (_jsx(EmptyState, { title: "Search Failed", description: error, action: {
                label: 'Try Again',
                onClick: () => window.location.reload(),
            } }));
    }
    // Empty state (no results)
    if (!results || results.length === 0) {
        return (_jsx(EmptyState, { title: "No Documents Found", description: "Try different keywords or adjust your filters" }));
    }
    // Results count
    const resultText = results.length === 1
        ? 'Found 1 document'
        : `Found ${results.length} document${results.length === 1 ? '' : 's'}`;
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsx("p", { className: "text-sm text-muted-foreground", children: resultText }) }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", children: results.map((result) => (_jsx(DocumentCard, { document: result.document, district: result.district, relevanceScore: result.relevanceScore, onSelect: () => onDocumentClick(result.document.id), showDistrict: true }, result.document.id))) })] }));
}
