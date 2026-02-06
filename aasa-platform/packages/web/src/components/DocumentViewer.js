import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Card, CardHeader, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ExternalLink, Copy, FileText, File, Globe } from 'lucide-react';
/**
 * Display a document with metadata, excerpt, and actions
 * Used inline in DocumentList or as standalone viewer
 */
export function DocumentViewer({ document, compact = false }) {
    const [isExpanded, setIsExpanded] = useState(false);
    // Copy to clipboard helper
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // TODO: Add toast notification
    };
    // Determine document type icon
    const getDocumentIcon = () => {
        const type = document.documentType?.toLowerCase() || '';
        if (type.includes('pdf')) {
            return _jsx(FileText, { className: "h-4 w-4" });
        }
        else if (type.includes('doc') || type.includes('word')) {
            return _jsx(File, { className: "h-4 w-4" });
        }
        else {
            return _jsx(Globe, { className: "h-4 w-4" });
        }
    };
    // Get badge variant based on document type
    const getTypeVariant = () => {
        const type = document.documentType?.toLowerCase() || '';
        if (type.includes('pdf'))
            return 'destructive';
        if (type.includes('strategic') || type.includes('plan'))
            return 'default';
        return 'secondary';
    };
    // Format date
    const formatDate = (date) => {
        if (!date)
            return 'Unknown';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    // Excerpt handling
    const excerpt = document.extractedText || '';
    const EXCERPT_LENGTH = 500;
    const needsTruncation = excerpt.length > EXCERPT_LENGTH;
    const displayText = isExpanded ? excerpt : excerpt.slice(0, EXCERPT_LENGTH);
    // Compact mode renders a simpler card
    if (compact) {
        return (_jsx(Card, { className: "bg-card border border-border hover:border-accent transition-colors", children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [getDocumentIcon(), _jsx(Badge, { variant: getTypeVariant(), className: "text-xs", children: document.documentType || 'Document' }), document.documentCategory && (_jsx(Badge, { variant: "outline", className: "text-xs", children: document.documentCategory }))] }), _jsx("p", { className: "text-sm text-muted-foreground line-clamp-2", children: displayText })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => window.open(document.documentUrl, '_blank', 'noopener,noreferrer'), "aria-label": "View full document", children: _jsx(ExternalLink, { className: "h-4 w-4" }) })] }) }) }));
    }
    // Full mode renders detailed view
    return (_jsxs(Card, { className: "bg-card border border-border", children: [_jsx(CardHeader, { className: "border-b border-border", children: _jsx("div", { className: "flex items-start justify-between gap-4", children: _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [getDocumentIcon(), _jsx(Badge, { variant: getTypeVariant(), children: document.documentType || 'Document' }), document.documentCategory && (_jsx(Badge, { variant: "outline", children: document.documentCategory })), _jsxs("span", { className: "text-xs text-muted-foreground", children: ["Crawled ", formatDate(document.lastCrawledAt)] })] }) }) }), _jsxs(CardContent, { className: "p-4 space-y-4", children: [document.documentUrl && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "URL:" }), _jsx("a", { href: document.documentUrl, target: "_blank", rel: "noopener noreferrer", className: "text-sm text-blue-600 dark:text-blue-400 hover:underline truncate flex-1", children: document.documentUrl })] })), excerpt && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "text-sm text-foreground whitespace-pre-wrap", children: [displayText, !isExpanded && needsTruncation && (_jsx("span", { className: "text-muted-foreground", children: "..." }))] }), needsTruncation && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setIsExpanded(!isExpanded), className: "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300", children: isExpanded ? 'Read Less' : 'Read More' }))] })), _jsxs("div", { className: "flex items-center gap-2 pt-2 border-t border-border", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => window.open(document.documentUrl, '_blank', 'noopener,noreferrer'), className: "flex-1 sm:flex-none", children: [_jsx(ExternalLink, { className: "h-4 w-4 mr-2" }), "View Full Document"] }), excerpt && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => copyToClipboard(excerpt), "aria-label": "Copy excerpt", children: _jsx(Copy, { className: "h-4 w-4" }) }))] }), document.textLength && (_jsx("div", { className: "flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border", children: _jsxs("span", { children: [document.textLength.toLocaleString(), " characters"] }) }))] })] }));
}
