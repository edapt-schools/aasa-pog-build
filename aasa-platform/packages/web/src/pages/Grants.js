import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { SearchResultsList } from '../components/SearchResultsList';
import { SearchFilters } from '../components/SearchFilters';
import { DocumentDetailPanel } from '../components/DocumentDetailPanel';
import { useSemanticSearch } from '../hooks/useSemanticSearch';
import { Menu, X } from 'lucide-react';
import { Button } from '../components/ui/button';
/**
 * Grants Mode - Semantic search across all district documents
 * Features:
 * - Natural language search with relevance scoring
 * - Document type and date filters
 * - Document detail panel with keyword evidence
 * - Similar documents recommendations
 */
export default function Grants() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [filters, setFilters] = useState({});
    const [selectedDocumentId, setSelectedDocumentId] = useState(null);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    // Build search params for API - pass all filters
    const searchApiParams = query.trim()
        ? {
            query: query.trim(),
            limit: 50, // Max 50 results
            state: filters.state,
            documentTypes: filters.documentType,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
        }
        : null;
    // Fetch search results
    const { data, loading, error } = useSemanticSearch(searchApiParams);
    // Find the selected document from results for the detail panel
    const selectedResult = data?.results.find(r => r.document.id === selectedDocumentId);
    // Handle selecting a different document (e.g., from similar docs)
    const handleDocumentSelect = (docId, _doc, _district) => {
        setSelectedDocumentId(docId);
    };
    // Handle search execution
    const handleSearch = () => {
        if (!query.trim())
            return;
        // Update URL query params
        setSearchParams({ q: query.trim() });
        // Close mobile filter drawer
        setIsFilterDrawerOpen(false);
    };
    // Handle document click
    const handleDocumentClick = (documentId) => {
        setSelectedDocumentId(documentId);
    };
    // Sync query from URL on mount
    useEffect(() => {
        const urlQuery = searchParams.get('q');
        if (urlQuery && urlQuery !== query) {
            setQuery(urlQuery);
        }
    }, [searchParams]);
    // Handle ESC key to close drawer/panel
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (selectedDocumentId) {
                    setSelectedDocumentId(null);
                }
                else if (isFilterDrawerOpen) {
                    setIsFilterDrawerOpen(false);
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedDocumentId, isFilterDrawerOpen]);
    return (_jsxs("div", { className: "flex h-screen overflow-hidden bg-background", children: [isFilterDrawerOpen && (_jsx("div", { className: "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden", onClick: () => setIsFilterDrawerOpen(false) })), _jsxs("aside", { className: `
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-background border-r border-border
          transform transition-transform duration-300 ease-in-out
          overflow-y-auto
          ${isFilterDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `, children: [_jsxs("div", { className: "lg:hidden sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between", children: [_jsx("h2", { className: "font-semibold", children: "Filters" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setIsFilterDrawerOpen(false), children: _jsx(X, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "p-4", children: _jsx(SearchFilters, { filters: filters, onChange: setFilters }) })] }), _jsxs("main", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsx("header", { className: "border-b border-border bg-background sticky top-0 z-30", children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Button, { variant: "outline", size: "sm", className: "lg:hidden", onClick: () => setIsFilterDrawerOpen(true), "aria-label": "Open filters", children: _jsx(Menu, { className: "h-4 w-4" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-heading-3 text-foreground", children: "Grants Mode" }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: "Search across 87,883 district documents" })] })] }) }), _jsx(SearchBar, { value: query, onChange: setQuery, onSearch: handleSearch, placeholder: "Search for 'portrait of a graduate', 'equity initiatives', etc.", isLoading: loading })] }) }), _jsx("div", { className: "flex-1 overflow-y-auto p-6", children: !query.trim() && !data ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-full text-center max-w-md mx-auto", children: [_jsx("h2", { className: "text-heading-4 text-foreground mb-2", children: "Search District Documents" }), _jsx("p", { className: "text-muted-foreground mb-6", children: "Use natural language to search across strategic plans, board policies, annual reports, and more. Our AI-powered search understands context and finds relevant documents based on meaning." }), _jsxs("div", { className: "space-y-2 text-sm text-muted-foreground text-left w-full", children: [_jsx("p", { className: "font-medium", children: "Try searching for:" }), _jsxs("ul", { className: "list-disc list-inside space-y-1 ml-2", children: [_jsx("li", { children: "\"portrait of a graduate\"" }), _jsx("li", { children: "\"competency-based learning\"" }), _jsx("li", { children: "\"social emotional learning initiatives\"" }), _jsx("li", { children: "\"equity and inclusion policies\"" })] })] })] })) : (_jsx(SearchResultsList, { results: data?.results, loading: loading, onDocumentClick: handleDocumentClick, error: error })) })] }), selectedDocumentId && selectedResult && (_jsx(DocumentDetailPanel, { documentId: selectedDocumentId, document: selectedResult.document, district: selectedResult.district, chunkText: selectedResult.chunkText, relevanceScore: selectedResult.relevanceScore, onClose: () => setSelectedDocumentId(null), onDocumentSelect: handleDocumentSelect })), _jsxs("div", { className: "sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true", children: [loading && 'Searching documents', data && `Found ${data.results.length} documents matching "${query}"`, error && `Error: ${error}`] })] }));
}
