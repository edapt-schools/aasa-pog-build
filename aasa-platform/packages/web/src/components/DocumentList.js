import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardHeader, CardContent } from './ui/card';
import { Badge } from './ui/badge';
export function DocumentList({ documents, onDocumentClick }) {
    if (documents.length === 0) {
        return (_jsx("div", { className: "text-center py-8 text-muted-foreground", children: "No documents found" }));
    }
    const getDocumentTypeColor = (type) => {
        switch (type?.toLowerCase()) {
            case 'pdf':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'html':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'text':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
        }
    };
    return (_jsx("div", { className: "space-y-4", children: documents.map((doc) => (_jsxs(Card, { className: `bg-card border border-border ${onDocumentClick ? 'cursor-pointer hover:shadow-md hover:border-accent' : ''}`, onClick: () => onDocumentClick?.(doc), children: [_jsx(CardHeader, { className: "p-4", children: _jsx("div", { className: "flex items-start gap-3", children: _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h4", { className: "text-base font-semibold text-foreground mb-1 truncate", children: doc.documentTitle || 'Untitled Document' }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [doc.documentType && (_jsx(Badge, { className: getDocumentTypeColor(doc.documentType), children: doc.documentType.toUpperCase() })), doc.documentCategory && (_jsx(Badge, { variant: "outline", className: "text-xs", children: doc.documentCategory }))] })] }) }) }), _jsxs(CardContent, { className: "p-4 pt-0 space-y-2", children: [_jsx("a", { href: doc.documentUrl, target: "_blank", rel: "noopener noreferrer", className: "text-sm text-blue-600 dark:text-blue-400 hover:underline block truncate", onClick: (e) => e.stopPropagation(), children: doc.documentUrl }), _jsxs("div", { className: "flex items-center gap-4 text-xs text-muted-foreground", children: [doc.textLength && (_jsxs("span", { children: [(doc.textLength / 1000).toFixed(1), "k chars"] })), doc.pageDepth && _jsxs("span", { children: ["Depth: ", doc.pageDepth] }), doc.extractionMethod && (_jsxs("span", { children: ["Method: ", doc.extractionMethod] }))] }), doc.extractedText && (_jsx("div", { className: "mt-3 pt-3 border-t border-border", children: _jsxs("p", { className: "text-sm text-muted-foreground line-clamp-3", children: [doc.extractedText.substring(0, 250), "..."] }) })), doc.lastCrawledAt && (_jsxs("div", { className: "text-xs text-muted-foreground pt-2", children: ["Last crawled:", ' ', new Date(doc.lastCrawledAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                })] }))] })] }, doc.id))) }));
}
