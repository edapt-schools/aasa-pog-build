import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
// Category colors
const CATEGORY_COLORS = {
    readiness: '#3b82f6', // Blue
    alignment: '#10b981', // Green
    activation: '#f97316', // Orange
    branding: '#8b5cf6', // Purple
};
/**
 * TrendingKeywords - Bar chart showing top keywords by frequency
 * Grouped by category with period toggle
 */
export function TrendingKeywords({ keywords, loading, period, onPeriodChange, }) {
    const [selectedCategory, setSelectedCategory] = useState(null);
    // Filter keywords by selected category
    const filteredKeywords = selectedCategory
        ? keywords.filter((k) => k.category === selectedCategory)
        : keywords;
    // Prepare data for chart (top 10)
    const chartData = filteredKeywords.slice(0, 10).map((k) => ({
        keyword: k.keyword.length > 20 ? k.keyword.substring(0, 20) + '...' : k.keyword,
        fullKeyword: k.keyword,
        count: k.currentCount,
        category: k.category,
        color: CATEGORY_COLORS[k.category],
    }));
    const periods = [
        { value: '7d', label: '7 Days' },
        { value: '30d', label: '30 Days' },
        { value: '90d', label: '90 Days' },
    ];
    const categories = ['readiness', 'alignment', 'activation', 'branding'];
    if (loading) {
        return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Trending Keywords" }) }), _jsx(CardContent, { children: _jsx("div", { className: "h-[300px] bg-muted animate-pulse rounded-lg" }) })] }));
    }
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { children: "Trending Keywords" }), _jsx("div", { className: "flex gap-1", children: periods.map((p) => (_jsx(Button, { variant: period === p.value ? 'default' : 'outline', size: "sm", onClick: () => onPeriodChange(p.value), children: p.label }, p.value))) })] }), _jsxs(CardContent, { children: [_jsxs("div", { className: "flex gap-2 mb-4 flex-wrap", children: [_jsx(Badge, { variant: selectedCategory === null ? 'default' : 'outline', className: "cursor-pointer", onClick: () => setSelectedCategory(null), children: "All" }), categories.map((cat) => (_jsx(Badge, { variant: selectedCategory === cat ? 'default' : 'outline', className: "cursor-pointer capitalize", style: {
                                    backgroundColor: selectedCategory === cat ? CATEGORY_COLORS[cat] : undefined,
                                    borderColor: CATEGORY_COLORS[cat],
                                }, onClick: () => setSelectedCategory(selectedCategory === cat ? null : cat), children: cat }, cat)))] }), chartData.length === 0 ? (_jsx("div", { className: "h-[300px] flex items-center justify-center text-muted-foreground", children: "No keyword data available" })) : (_jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(BarChart, { data: chartData, layout: "vertical", margin: { top: 5, right: 30, left: 100, bottom: 5 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", horizontal: true, vertical: false }), _jsx(XAxis, { type: "number" }), _jsx(YAxis, { type: "category", dataKey: "keyword", width: 100, tick: { fontSize: 12 } }), _jsx(Tooltip, { content: ({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (_jsxs("div", { className: "bg-popover text-popover-foreground p-3 rounded-lg shadow-lg border", children: [_jsx("p", { className: "font-medium", children: data.fullKeyword }), _jsxs("p", { className: "text-sm text-muted-foreground capitalize", children: ["Category: ", data.category] }), _jsxs("p", { className: "text-sm font-semibold", children: ["Found in ", data.count, " districts"] })] }));
                                        }
                                        return null;
                                    } }), _jsx(Bar, { dataKey: "count", radius: [0, 4, 4, 0], children: chartData.map((entry, index) => (_jsx(Cell, { fill: entry.color }, `cell-${index}`))) })] }) })), _jsx("div", { className: "flex justify-center gap-4 mt-4", children: categories.map((cat) => (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("div", { className: "w-3 h-3 rounded-sm", style: { backgroundColor: CATEGORY_COLORS[cat] } }), _jsx("span", { className: "text-xs capitalize text-muted-foreground", children: cat })] }, cat))) })] })] }));
}
