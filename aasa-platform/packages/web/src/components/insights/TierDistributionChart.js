import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
const TIER_COLORS = {
    tier1: '#10b981', // Emerald
    tier2: '#f59e0b', // Amber
    tier3: '#94a3b8', // Slate
};
const TIER_LABELS = {
    tier1: 'Tier 1 (High Priority)',
    tier2: 'Tier 2 (Medium)',
    tier3: 'Tier 3 (Lower)',
};
/**
 * TierDistributionChart - Donut chart showing tier distribution
 * Shows the breakdown of districts by outreach tier
 */
export function TierDistributionChart({ tierDistribution, loading }) {
    const total = tierDistribution.tier1 + tierDistribution.tier2 + tierDistribution.tier3;
    const data = [
        { name: TIER_LABELS.tier1, value: tierDistribution.tier1, tier: 'tier1' },
        { name: TIER_LABELS.tier2, value: tierDistribution.tier2, tier: 'tier2' },
        { name: TIER_LABELS.tier3, value: tierDistribution.tier3, tier: 'tier3' },
    ];
    if (loading) {
        return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Tier Distribution" }) }), _jsx(CardContent, { children: _jsx("div", { className: "h-[280px] bg-muted animate-pulse rounded-lg" }) })] }));
    }
    if (total === 0) {
        return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Tier Distribution" }) }), _jsx(CardContent, { children: _jsx("div", { className: "h-[280px] flex items-center justify-center text-muted-foreground", children: "No scored districts yet" }) })] }));
    }
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Tier Distribution" }) }), _jsxs(CardContent, { children: [_jsx(ResponsiveContainer, { width: "100%", height: 280, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: data, cx: "50%", cy: "50%", innerRadius: 60, outerRadius: 100, paddingAngle: 2, dataKey: "value", label: ({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`, labelLine: false, children: data.map((entry) => (_jsx(Cell, { fill: TIER_COLORS[entry.tier], stroke: "transparent" }, entry.tier))) }), _jsx(Tooltip, { content: ({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (_jsxs("div", { className: "bg-popover text-popover-foreground p-3 rounded-lg shadow-lg border", children: [_jsx("p", { className: "font-medium", children: data.name }), _jsxs("p", { className: "text-sm", children: [data.value.toLocaleString(), " districts"] }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [((data.value / total) * 100).toFixed(1), "% of total"] })] }));
                                        }
                                        return null;
                                    } }), _jsx(Legend, { verticalAlign: "bottom", height: 36, formatter: (value) => (_jsx("span", { className: "text-sm text-foreground", children: value })) })] }) }), _jsxs("div", { className: "grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border", children: [_jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-2xl font-bold text-emerald-600", children: tierDistribution.tier1 }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Tier 1" })] }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-2xl font-bold text-amber-600", children: tierDistribution.tier2 }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Tier 2" })] }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-2xl font-bold text-slate-600", children: tierDistribution.tier3 }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Tier 3" })] })] })] })] }));
}
