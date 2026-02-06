import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { X, Copy, ExternalLink, Loader2, FileText, Globe, File, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardContent } from './ui/card';
import { useKeywordEvidence } from '../hooks/useKeywordEvidence';
import { useSimilarDocuments } from '../hooks/useSimilarDocuments';
export function DocumentDetailPanel({ documentId, document, district, chunkText, relevanceScore, onClose, onDocumentSelect, }) {
    const [activeTab, setActiveTab] = useState('details');
    const [isExcerptExpanded, setIsExcerptExpanded] = useState(false);
    const panelRef = useRef(null);
    // Fetch keyword evidence for the district
    const { data: evidenceData, loading: evidenceLoading, error: evidenceError } = useKeywordEvidence(district.ncesId);
    // Fetch similar documents
    const { data: similarData, loading: similarLoading, error: similarError } = useSimilarDocuments(documentId, 10);
    // ESC key to close
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);
    // Focus management - focus panel when opened
    useEffect(() => {
        if (panelRef.current) {
            panelRef.current.focus();
        }
    }, []);
    // Copy to clipboard helper
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // TODO: Add toast notification
    };
    // Get document type icon
    const getDocumentIcon = () => {
        const type = document.documentType?.toLowerCase() || '';
        if (type.includes('pdf'))
            return _jsx(FileText, { className: "h-4 w-4" });
        else if (type.includes('doc') || type.includes('word'))
            return _jsx(File, { className: "h-4 w-4" });
        else
            return _jsx(Globe, { className: "h-4 w-4" });
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
    // Format the excerpt text
    const excerptText = chunkText || document.extractedText || '';
    const truncatedExcerpt = excerptText.length > 500 ? excerptText.slice(0, 500) + '...' : excerptText;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/50 backdrop-blur-sm z-40", onClick: onClose, "aria-hidden": "true" }), _jsxs("div", { ref: panelRef, className: "fixed right-0 top-0 h-full w-full sm:w-4/5 lg:w-3/5 bg-background border-l border-border z-50 overflow-y-auto transform transition-transform duration-300 shadow-2xl", role: "dialog", "aria-modal": "true", "aria-labelledby": "document-panel-title", tabIndex: -1, children: [_jsxs("div", { className: "sticky top-0 bg-background border-b border-border z-10", children: [_jsxs("div", { className: "flex items-center justify-between p-4", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [getDocumentIcon(), _jsx(Badge, { variant: getTypeVariant(), children: document.documentType || 'Document' }), document.documentCategory && (_jsx(Badge, { variant: "outline", children: document.documentCategory })), relevanceScore !== undefined && (_jsxs(Badge, { variant: "secondary", className: "bg-gradient-to-r from-blue-500/20 to-purple-500/20", children: [Math.round(relevanceScore * 100), "% match"] }))] }), _jsx("h2", { id: "document-panel-title", className: "text-xl font-semibold text-foreground truncate", children: document.documentTitle || 'Untitled Document' }), _jsxs("p", { className: "text-sm text-muted-foreground mt-1", children: [district.name, ", ", district.state] })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: onClose, "aria-label": "Close panel", children: _jsx(X, { className: "h-5 w-5" }) })] }), _jsxs("div", { className: "flex border-t border-border", children: [_jsx("button", { className: `flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'details'
                                            ? 'text-foreground border-b-2 border-accent'
                                            : 'text-muted-foreground hover:text-foreground'}`, onClick: () => setActiveTab('details'), role: "tab", "aria-selected": activeTab === 'details', children: "Details" }), _jsxs("button", { className: `flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'evidence'
                                            ? 'text-foreground border-b-2 border-accent'
                                            : 'text-muted-foreground hover:text-foreground'}`, onClick: () => setActiveTab('evidence'), role: "tab", "aria-selected": activeTab === 'evidence', children: ["Evidence", evidenceData && evidenceData.totalScore !== null && (_jsx(Badge, { variant: "secondary", className: "ml-2", children: evidenceData.totalScore.toFixed(1) }))] }), _jsxs("button", { className: `flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'similar'
                                            ? 'text-foreground border-b-2 border-accent'
                                            : 'text-muted-foreground hover:text-foreground'}`, onClick: () => setActiveTab('similar'), role: "tab", "aria-selected": activeTab === 'similar', children: ["Similar", similarData && similarData.total > 0 && (_jsx(Badge, { variant: "secondary", className: "ml-2", children: similarData.total }))] })] })] }), _jsxs("div", { className: "p-6 space-y-6", children: [activeTab === 'details' && (_jsxs(_Fragment, { children: [_jsxs(Card, { children: [_jsx(CardHeader, { className: "border-b border-border", children: _jsx("h3", { className: "text-lg font-semibold text-foreground", children: "Document Information" }) }), _jsxs(CardContent, { className: "p-4 space-y-3", children: [document.documentUrl && (_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "URL" }), _jsxs("div", { className: "flex items-center gap-2 max-w-[60%]", children: [_jsx("a", { href: document.documentUrl, target: "_blank", rel: "noopener noreferrer", className: "text-sm text-blue-600 dark:text-blue-400 hover:underline truncate", children: document.documentUrl }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => copyToClipboard(document.documentUrl), "aria-label": "Copy URL", children: _jsx(Copy, { className: "h-3 w-3" }) })] })] })), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Type" }), _jsx("span", { className: "text-sm font-medium text-foreground", children: document.documentType || 'Unknown' })] }), document.documentCategory && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Category" }), _jsx("span", { className: "text-sm font-medium text-foreground", children: document.documentCategory })] })), document.textLength && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Content Length" }), _jsxs("span", { className: "text-sm font-medium text-foreground", children: [document.textLength.toLocaleString(), " characters"] })] })), document.lastCrawledAt && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Last Crawled" }), _jsx("span", { className: "text-sm font-medium text-foreground", children: new Date(document.lastCrawledAt).toLocaleDateString() })] }))] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "border-b border-border", children: _jsx("h3", { className: "text-lg font-semibold text-foreground", children: "District" }) }), _jsxs(CardContent, { className: "p-4 space-y-3", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Name" }), _jsx("span", { className: "text-sm font-medium text-foreground", children: district.name })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Location" }), _jsxs("span", { className: "text-sm font-medium text-foreground", children: [district.city, ", ", district.state] })] }), district.superintendentName && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Superintendent" }), _jsx("span", { className: "text-sm font-medium text-foreground", children: district.superintendentName })] })), district.superintendentEmail && (_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Email" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("a", { href: `mailto:${district.superintendentEmail}`, className: "text-sm text-blue-600 dark:text-blue-400 hover:underline", children: district.superintendentEmail }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => copyToClipboard(district.superintendentEmail), "aria-label": "Copy email", children: _jsx(Copy, { className: "h-3 w-3" }) })] })] }))] })] }), excerptText && (_jsxs(Card, { children: [_jsx(CardHeader, { className: "border-b border-border", children: _jsx("h3", { className: "text-lg font-semibold text-foreground", children: "Matched Excerpt" }) }), _jsxs(CardContent, { className: "p-4", children: [_jsx("p", { className: "text-sm text-foreground whitespace-pre-wrap", children: isExcerptExpanded ? excerptText : truncatedExcerpt }), excerptText.length > 500 && (_jsx(Button, { variant: "link", size: "sm", onClick: () => setIsExcerptExpanded(!isExcerptExpanded), className: "mt-2 p-0", children: isExcerptExpanded ? 'Show less' : 'Read more' })), _jsxs("div", { className: "flex gap-2 mt-4", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => copyToClipboard(excerptText), children: [_jsx(Copy, { className: "h-3 w-3 mr-2" }), "Copy Excerpt"] }), document.documentUrl && (_jsxs(Button, { variant: "outline", size: "sm", onClick: () => window.open(document.documentUrl, '_blank'), children: [_jsx(ExternalLink, { className: "h-3 w-3 mr-2" }), "View Full Document"] }))] })] })] }))] })), activeTab === 'evidence' && (_jsxs(_Fragment, { children: [evidenceLoading && (_jsx("div", { className: "flex items-center justify-center py-12", children: _jsx(Loader2, { className: "h-8 w-8 animate-spin text-muted-foreground" }) })), evidenceError && (_jsx(Card, { className: "bg-destructive/10 border-destructive", children: _jsx(CardContent, { className: "p-4", children: _jsx("p", { className: "text-sm text-destructive", children: evidenceError }) }) })), !evidenceLoading && !evidenceError && evidenceData && (_jsxs(_Fragment, { children: [_jsxs(Card, { children: [_jsx(CardHeader, { className: "border-b border-border", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "text-lg font-semibold text-foreground", children: ["Keyword Scores for ", evidenceData.districtName] }), evidenceData.totalScore !== null && (_jsxs(Badge, { variant: "default", className: "text-lg px-3 py-1", children: ["Total: ", evidenceData.totalScore.toFixed(1)] }))] }) }), _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(CategoryScoreCard, { label: "Readiness", category: evidenceData.readiness, color: "bg-blue-500" }), _jsx(CategoryScoreCard, { label: "Alignment", category: evidenceData.alignment, color: "bg-green-500" }), _jsx(CategoryScoreCard, { label: "Activation", category: evidenceData.activation, color: "bg-purple-500" }), _jsx(CategoryScoreCard, { label: "Branding", category: evidenceData.branding, color: "bg-orange-500" })] }) })] }), evidenceData.readiness && evidenceData.readiness.keywordsFound.length > 0 && (_jsx(CategoryEvidenceCard, { label: "Readiness", category: evidenceData.readiness, color: "blue" })), evidenceData.alignment && evidenceData.alignment.keywordsFound.length > 0 && (_jsx(CategoryEvidenceCard, { label: "Alignment", category: evidenceData.alignment, color: "green" })), evidenceData.activation && evidenceData.activation.keywordsFound.length > 0 && (_jsx(CategoryEvidenceCard, { label: "Activation", category: evidenceData.activation, color: "purple" })), evidenceData.branding && evidenceData.branding.keywordsFound.length > 0 && (_jsx(CategoryEvidenceCard, { label: "Branding", category: evidenceData.branding, color: "orange" })), (!evidenceData.readiness || evidenceData.readiness.keywordsFound.length === 0) &&
                                                (!evidenceData.alignment || evidenceData.alignment.keywordsFound.length === 0) &&
                                                (!evidenceData.activation || evidenceData.activation.keywordsFound.length === 0) &&
                                                (!evidenceData.branding || evidenceData.branding.keywordsFound.length === 0) && (_jsx(Card, { children: _jsx(CardContent, { className: "p-8 text-center", children: _jsx("p", { className: "text-muted-foreground", children: "No keyword evidence found for this district." }) }) }))] }))] })), activeTab === 'similar' && (_jsxs(_Fragment, { children: [similarLoading && (_jsx("div", { className: "flex items-center justify-center py-12", children: _jsx(Loader2, { className: "h-8 w-8 animate-spin text-muted-foreground" }) })), similarError && (_jsx(Card, { className: "bg-destructive/10 border-destructive", children: _jsx(CardContent, { className: "p-4", children: _jsx("p", { className: "text-sm text-destructive", children: similarError }) }) })), !similarLoading && !similarError && similarData && (_jsx(_Fragment, { children: similarData.results.length > 0 ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("p", { className: "text-sm text-muted-foreground", children: ["Found ", similarData.total, " similar document", similarData.total !== 1 ? 's' : '', " based on content similarity."] }), similarData.results.map((similar) => (_jsx(SimilarDocumentCard, { similar: similar, onClick: () => {
                                                        if (onDocumentSelect) {
                                                            onDocumentSelect(similar.document.id, similar.document, similar.district);
                                                        }
                                                    } }, similar.document.id)))] })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-8 text-center", children: _jsx("p", { className: "text-muted-foreground", children: "No similar documents found." }) }) })) }))] }))] })] })] }));
}
// Helper component for category score display
function CategoryScoreCard({ label, category, color, }) {
    const score = category?.score ?? 0;
    const maxScore = 10; // Assume max score of 10
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-muted-foreground", children: label }), _jsx("span", { className: "font-medium text-foreground", children: score !== null ? score.toFixed(1) : '0.0' })] }), _jsx("div", { className: "h-2 bg-muted rounded-full overflow-hidden", children: _jsx("div", { className: `h-full ${color} transition-all duration-300`, style: { width: `${Math.min((score / maxScore) * 100, 100)}%` } }) }), category && category.keywordsFound.length > 0 && (_jsxs("p", { className: "text-xs text-muted-foreground", children: [category.keywordsFound.length, " keyword", category.keywordsFound.length !== 1 ? 's' : '', " found"] }))] }));
}
// Helper component for category evidence display
function CategoryEvidenceCard({ label, category, color, }) {
    const colorClasses = {
        blue: 'bg-blue-500/10 border-blue-500/20',
        green: 'bg-green-500/10 border-green-500/20',
        purple: 'bg-purple-500/10 border-purple-500/20',
        orange: 'bg-orange-500/10 border-orange-500/20',
    };
    const badgeClasses = {
        blue: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
        green: 'bg-green-500/20 text-green-700 dark:text-green-300',
        purple: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
        orange: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
    };
    return (_jsxs(Card, { className: colorClasses[color], children: [_jsx(CardHeader, { className: "border-b border-border/50 pb-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h4", { className: "font-semibold text-foreground", children: label }), _jsxs("span", { className: "text-sm text-muted-foreground", children: [category.totalMentions, " mention", category.totalMentions !== 1 ? 's' : ''] })] }) }), _jsxs(CardContent, { className: "p-4 space-y-3", children: [_jsx("div", { className: "flex flex-wrap gap-2", children: category.keywordsFound.map((keyword, idx) => (_jsx(Badge, { variant: "secondary", className: badgeClasses[color], children: keyword }, idx))) }), category.documents && category.documents.length > 0 && (_jsxs("div", { className: "space-y-2 mt-4", children: [_jsx("p", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: "Evidence from documents:" }), category.documents.slice(0, 3).map((doc, idx) => (_jsxs("div", { className: "bg-background/50 rounded p-3 text-sm", children: [_jsx("div", { className: "flex items-center gap-2 mb-2", children: _jsx(Badge, { variant: "outline", className: "text-xs", children: doc.documentType }) }), doc.text && (_jsxs("p", { className: "text-muted-foreground line-clamp-3 italic", children: ["\"", doc.text, "\""] }))] }, idx)))] }))] })] }));
}
// Helper component for similar document cards
function SimilarDocumentCard({ similar, onClick, }) {
    return (_jsx(Card, { className: "cursor-pointer hover:border-accent transition-colors", onClick: onClick, children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx(Badge, { variant: "secondary", className: "text-xs", children: similar.document.documentType || 'Document' }), _jsxs(Badge, { variant: "outline", className: "bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-xs", children: [Math.round(similar.similarity * 100), "% similar"] })] }), _jsx("h4", { className: "font-medium text-foreground truncate", children: similar.document.documentTitle || 'Untitled Document' }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [similar.district.name, ", ", similar.district.state] })] }), _jsx(ChevronRight, { className: "h-5 w-5 text-muted-foreground flex-shrink-0" })] }) }) }));
}
