import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FileText, File, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
/**
 * Document card for search results
 * Shows document type, title, excerpt, and relevance score
 */
export function DocumentCard({ document, district, relevanceScore, onSelect, showDistrict = false, }) {
    // Get document type icon
    const getDocumentIcon = () => {
        const type = document.documentType?.toLowerCase() || '';
        if (type.includes('pdf'))
            return _jsx(FileText, { className: "h-4 w-4" });
        if (type.includes('web'))
            return _jsx(Globe, { className: "h-4 w-4" });
        return _jsx(File, { className: "h-4 w-4" });
    };
    // Get document type badge color
    const getTypeBadgeColor = () => {
        const type = document.documentType?.toLowerCase() || '';
        if (type.includes('strategic'))
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        if (type.includes('board'))
            return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
        if (type.includes('annual'))
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    };
    // Get excerpt text (first 150 chars)
    const getExcerpt = () => {
        if (!document.extractedText)
            return 'No preview available';
        const text = document.extractedText.trim();
        return text.length > 150 ? text.substring(0, 150) + '...' : text;
    };
    // Format relevance score as percentage
    const scorePercent = relevanceScore ? Math.round(relevanceScore * 100) : null;
    return (_jsxs(Card, { className: "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-accent", onClick: onSelect, children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsxs(Badge, { variant: "secondary", className: getTypeBadgeColor(), children: [_jsx("span", { className: "mr-1", children: getDocumentIcon() }), document.documentType || 'Document'] }), document.documentCategory && (_jsx("span", { className: "text-xs text-muted-foreground", children: document.documentCategory }))] }), _jsx("h3", { className: "text-sm font-semibold text-foreground line-clamp-2", children: document.documentTitle || 'Untitled Document' }), showDistrict && district && (_jsxs("p", { className: "text-xs text-muted-foreground mt-1", children: [district.name, ", ", district.state] }))] }), scorePercent !== null && (_jsxs(Badge, { variant: "outline", className: "shrink-0 font-semibold", style: {
                                background: `linear-gradient(135deg, hsl(var(--accent) / 0.1) 0%, hsl(var(--accent) / 0.2) 100%)`,
                                borderColor: 'hsl(var(--accent))',
                                color: 'hsl(var(--accent-foreground))',
                            }, children: [scorePercent, "%"] }))] }) }), _jsxs(CardContent, { className: "pt-0", children: [_jsx("p", { className: "text-sm text-muted-foreground line-clamp-3", children: getExcerpt() }), document.documentUrl && (_jsx("p", { className: "text-xs text-muted-foreground mt-2 truncate", children: document.documentUrl }))] })] }));
}
