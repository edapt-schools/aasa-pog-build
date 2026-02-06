import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from 'react';
import { X, Users, FileText, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { useStateDetail } from '../../hooks/useStateStats';
/**
 * StateDetailPanel - Slide-in panel showing detailed state statistics
 * Shows superintendent coverage, score breakdown, tier distribution, and top districts
 */
export function StateDetailPanel({ stateCode, onClose }) {
    const { data, loading, error } = useStateDetail(stateCode);
    // Handle ESC key to close panel
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);
    const getTierBadgeVariant = (tier) => {
        switch (tier) {
            case 'tier1':
                return 'default';
            case 'tier2':
                return 'secondary';
            default:
                return 'outline';
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/50 backdrop-blur-sm z-40", onClick: onClose, "aria-hidden": "true" }), _jsxs("aside", { className: "fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-background border-l border-border overflow-y-auto shadow-xl", role: "dialog", "aria-modal": "true", "aria-label": `Details for ${data?.stateName || stateCode}`, children: [_jsxs("header", { className: "sticky top-0 z-10 bg-background border-b border-border p-4 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold", children: loading ? 'Loading...' : data?.stateName || stateCode }), data && (_jsxs("p", { className: "text-sm text-muted-foreground", children: [data.totalDistricts.toLocaleString(), " districts"] }))] }), _jsx(Button, { variant: "ghost", size: "icon", onClick: onClose, "aria-label": "Close panel", children: _jsx(X, { className: "h-5 w-5" }) })] }), _jsxs("div", { className: "p-4 space-y-6", children: [loading && (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "h-24 bg-muted animate-pulse rounded-lg" }), _jsx("div", { className: "h-24 bg-muted animate-pulse rounded-lg" }), _jsx("div", { className: "h-48 bg-muted animate-pulse rounded-lg" })] })), error && (_jsx("div", { className: "text-center py-8", children: _jsx("p", { className: "text-destructive", children: error }) })), data && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center", children: _jsx(Users, { className: "h-5 w-5 text-primary" }) }), _jsxs("div", { children: [_jsxs("p", { className: "text-2xl font-bold", children: [data.superintendentCoverage.percent, "%"] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Coverage" })] })] }) }) }), _jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center", children: _jsx(FileText, { className: "h-5 w-5 text-primary" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold", children: data.documentsCount.toLocaleString() }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Documents" })] })] }) }) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold mb-3", children: "Average Scores" }), _jsx("div", { className: "space-y-3", children: ['readiness', 'alignment', 'activation', 'branding'].map((category) => {
                                                    const score = data.scoreStats.averageScores[category];
                                                    const colors = {
                                                        readiness: 'bg-blue-500',
                                                        alignment: 'bg-green-500',
                                                        activation: 'bg-orange-500',
                                                        branding: 'bg-purple-500',
                                                    };
                                                    return (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: "capitalize", children: category }), _jsx("span", { className: "font-medium", children: score.toFixed(1) })] }), _jsx("div", { className: "h-2 bg-muted rounded-full overflow-hidden", children: _jsx("div", { className: `h-full ${colors[category]} rounded-full transition-all`, style: { width: `${(score / 10) * 100}%` } }) })] }, category));
                                                }) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold mb-3", children: "Tier Distribution" }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("div", { className: "flex-1 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-center", children: [_jsx("p", { className: "text-2xl font-bold text-emerald-600", children: data.scoreStats.tierDistribution.tier1 }), _jsx("p", { className: "text-xs text-emerald-600/80", children: "Tier 1" })] }), _jsxs("div", { className: "flex-1 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center", children: [_jsx("p", { className: "text-2xl font-bold text-amber-600", children: data.scoreStats.tierDistribution.tier2 }), _jsx("p", { className: "text-xs text-amber-600/80", children: "Tier 2" })] }), _jsxs("div", { className: "flex-1 p-3 bg-slate-50 dark:bg-slate-950/30 rounded-lg text-center", children: [_jsx("p", { className: "text-2xl font-bold text-slate-600", children: data.scoreStats.tierDistribution.tier3 }), _jsx("p", { className: "text-xs text-slate-600/80", children: "Tier 3" })] })] })] }), data.topDistricts.length > 0 && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold mb-3", children: "Top Districts by Score" }), _jsx("div", { className: "space-y-2", children: data.topDistricts.map((district, index) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { className: "text-sm font-medium text-muted-foreground w-5", children: [index + 1, "."] }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-sm", children: district.name }), _jsx("p", { className: "text-xs text-muted-foreground", children: district.ncesId })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: getTierBadgeVariant(district.tier), children: district.tier.toUpperCase() }), _jsx("span", { className: "font-semibold text-sm", children: district.totalScore.toFixed(1) })] })] }, district.ncesId))) })] })), _jsx("div", { className: "pt-4 border-t border-border", children: _jsxs(Button, { variant: "outline", className: "w-full", onClick: () => {
                                                window.location.href = `/discovery?state=${stateCode}`;
                                            }, children: [_jsx(ExternalLink, { className: "h-4 w-4 mr-2" }), "View All Districts in Discovery"] }) })] }))] })] })] }));
}
