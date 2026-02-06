import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardHeader, CardContent } from './ui/card';
import { Badge } from './ui/badge';
export function KeywordScoreCard({ scores, showDetails = false }) {
    const categories = [
        {
            name: 'Readiness',
            score: scores.readinessScore,
            description: 'District readiness indicators',
            color: 'text-blue-600 dark:text-blue-400',
        },
        {
            name: 'Alignment',
            score: scores.alignmentScore,
            description: 'Strategic alignment markers',
            color: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            name: 'Activation',
            score: scores.activationScore,
            description: 'Engagement and activation signals',
            color: 'text-cyan-600 dark:text-cyan-400',
        },
        {
            name: 'Branding',
            score: scores.brandingScore,
            description: 'Brand presence and messaging',
            color: 'text-amber-600 dark:text-amber-400',
        },
    ];
    const getTierColor = (tier) => {
        switch (tier) {
            case 'tier1':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            case 'tier2':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            case 'tier3':
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
        }
    };
    const getScoreBar = (score, maxScore = 100) => {
        if (!score)
            return 0;
        const numScore = parseFloat(score);
        return (numScore / maxScore) * 100;
    };
    return (_jsxs(Card, { className: "bg-card border border-border", children: [_jsx(CardHeader, { className: "border-b border-border p-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold text-foreground", children: "Keyword Scores" }), scores.outreachTier && (_jsx(Badge, { className: getTierColor(scores.outreachTier), children: scores.outreachTier.toUpperCase() }))] }) }), _jsxs(CardContent, { className: "p-4 space-y-4", children: [scores.totalScore && (_jsxs("div", { className: "pb-4 border-b border-border", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-sm font-medium text-foreground", children: "Total Score" }), _jsx("span", { className: "text-2xl font-bold text-foreground", children: parseFloat(scores.totalScore).toFixed(1) })] }), _jsx("div", { className: "w-full h-2 bg-muted rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-accent transition-all", style: { width: `${getScoreBar(scores.totalScore, 400)}%` } }) })] })), _jsx("div", { className: "space-y-3", children: categories.map((category) => (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: `text-sm font-medium ${category.color}`, children: category.name }), _jsx("span", { className: "text-sm font-semibold text-foreground", children: category.score ? parseFloat(category.score).toFixed(1) : '0.0' })] }), showDetails && (_jsx("p", { className: "text-xs text-muted-foreground mb-2", children: category.description })), _jsx("div", { className: "w-full h-1.5 bg-muted rounded-full overflow-hidden", children: _jsx("div", { className: `h-full ${category.color.replace('text-', 'bg-')} transition-all`, style: { width: `${getScoreBar(category.score)}%` } }) })] }, category.name))) }), showDetails && (_jsx("div", { className: "pt-4 border-t border-border", children: _jsxs("div", { className: "text-xs text-muted-foreground space-y-1", children: [_jsxs("p", { children: [_jsx("strong", { children: "Tier 1:" }), " High priority (Total ", '>', " 250)"] }), _jsxs("p", { children: [_jsx("strong", { children: "Tier 2:" }), " Medium priority (Total 100-250)"] }), _jsxs("p", { children: [_jsx("strong", { children: "Tier 3:" }), " Lower priority (Total ", '<', " 100)"] })] }) }))] })] }));
}
