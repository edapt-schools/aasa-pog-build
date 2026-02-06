import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { NationalOverviewCards } from '../components/insights/NationalOverviewCards';
import { StateMap } from '../components/insights/StateMap';
import { StateDetailPanel } from '../components/insights/StateDetailPanel';
import { TrendingKeywords } from '../components/insights/TrendingKeywords';
import { TierDistributionChart } from '../components/insights/TierDistributionChart';
import { useInsightsOverview } from '../hooks/useInsightsOverview';
import { useAllStateStats } from '../hooks/useStateStats';
import { useTrending } from '../hooks/useTrending';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
/**
 * Insights Mode - Analytics dashboard for AASA leadership
 * Features:
 * - National overview statistics
 * - Interactive US map colored by selected metric
 * - State detail panel on click
 * - Trending keywords visualization
 * - Tier distribution chart
 * - State comparison table
 */
export default function Insights() {
    const [selectedState, setSelectedState] = useState(null);
    const [trendingPeriod, setTrendingPeriod] = useState('30d');
    // Fetch data with hooks
    const { data: overviewData, loading: overviewLoading } = useInsightsOverview();
    const { data: statesData, loading: statesLoading } = useAllStateStats();
    const { data: trendingData, loading: trendingLoading } = useTrending(trendingPeriod);
    // Handle state selection
    const handleStateClick = (stateCode) => {
        setSelectedState(stateCode);
    };
    const handleClosePanel = () => {
        setSelectedState(null);
    };
    // Sort states for table (by total districts descending)
    const sortedStates = statesData?.states
        ? [...statesData.states].sort((a, b) => b.totalDistricts - a.totalDistricts)
        : [];
    return (_jsxs("div", { className: "flex flex-col min-h-screen bg-background", children: [_jsx("header", { className: "border-b border-border bg-background sticky top-0 z-30", children: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-heading-3 text-foreground", children: "Insights Dashboard" }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: "National overview and state-level analytics" })] }), overviewData && (_jsxs("p", { className: "text-xs text-muted-foreground", children: ["Last updated: ", new Date(overviewData.lastUpdated).toLocaleDateString()] }))] }) }) }), _jsxs("main", { className: "flex-1 p-6 space-y-6", children: [_jsx(NationalOverviewCards, { data: overviewData, loading: overviewLoading }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsx("div", { className: "lg:col-span-2", children: _jsx(StateMap, { states: statesData?.states || [], loading: statesLoading, onStateClick: handleStateClick, selectedState: selectedState }) }), _jsx("div", { children: _jsx(TierDistributionChart, { tierDistribution: overviewData?.tierDistribution || { tier1: 0, tier2: 0, tier3: 0 }, loading: overviewLoading }) })] }), _jsx(TrendingKeywords, { keywords: trendingData?.keywords || [], loading: trendingLoading, period: trendingPeriod, onPeriodChange: setTrendingPeriod }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "State Comparison" }) }), _jsx(CardContent, { children: statesLoading ? (_jsx("div", { className: "h-64 bg-muted animate-pulse rounded-lg" })) : (_jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border", children: [_jsx("th", { className: "text-left py-3 px-4 font-medium text-muted-foreground", children: "State" }), _jsx("th", { className: "text-right py-3 px-4 font-medium text-muted-foreground", children: "Districts" }), _jsx("th", { className: "text-right py-3 px-4 font-medium text-muted-foreground", children: "Coverage" }), _jsx("th", { className: "text-right py-3 px-4 font-medium text-muted-foreground", children: "Avg Score" }), _jsx("th", { className: "text-right py-3 px-4 font-medium text-muted-foreground", children: "Tier 1" }), _jsx("th", { className: "text-right py-3 px-4 font-medium text-muted-foreground", children: "Documents" }), _jsx("th", { className: "text-center py-3 px-4 font-medium text-muted-foreground", children: "Action" })] }) }), _jsx("tbody", { children: sortedStates.slice(0, 20).map((state) => (_jsxs("tr", { className: "border-b border-border/50 hover:bg-muted/50 transition-colors", children: [_jsx("td", { className: "py-3 px-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium", children: state.stateName }), _jsx(Badge, { variant: "outline", className: "text-xs", children: state.stateCode })] }) }), _jsx("td", { className: "text-right py-3 px-4", children: state.totalDistricts.toLocaleString() }), _jsx("td", { className: "text-right py-3 px-4", children: _jsxs("span", { className: state.superintendentCoverage >= 50
                                                                        ? 'text-emerald-600'
                                                                        : state.superintendentCoverage >= 25
                                                                            ? 'text-amber-600'
                                                                            : 'text-slate-500', children: [state.superintendentCoverage.toFixed(1), "%"] }) }), _jsx("td", { className: "text-right py-3 px-4", children: state.avgTotalScore > 0 ? state.avgTotalScore.toFixed(1) : '-' }), _jsx("td", { className: "text-right py-3 px-4", children: _jsx("span", { className: "text-emerald-600 font-medium", children: state.tier1Count }) }), _jsx("td", { className: "text-right py-3 px-4", children: state.documentsCount.toLocaleString() }), _jsx("td", { className: "text-center py-3 px-4", children: _jsx("button", { onClick: () => handleStateClick(state.stateCode), className: "text-primary hover:underline text-sm", children: "View" }) })] }, state.stateCode))) })] }), sortedStates.length > 20 && (_jsx("p", { className: "text-center text-sm text-muted-foreground mt-4", children: "Showing top 20 states by district count" }))] })) })] })] }), selectedState && (_jsx(StateDetailPanel, { stateCode: selectedState, onClose: handleClosePanel }))] }));
}
