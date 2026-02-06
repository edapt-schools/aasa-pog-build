import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Building2, Users, FileText, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
function StatCard({ title, value, subtitle, icon, loading }) {
    return (_jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-muted-foreground", children: title }), loading ? (_jsx("div", { className: "h-8 w-24 bg-muted animate-pulse rounded mt-1" })) : (_jsx("p", { className: "text-2xl font-bold text-foreground", children: value })), subtitle && (_jsx("p", { className: "text-sm text-muted-foreground mt-1", children: subtitle }))] }), _jsx("div", { className: "h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center", children: icon })] }) }) }));
}
/**
 * NationalOverviewCards - Grid of 4 stat cards showing national metrics
 * Displays total districts, superintendent coverage, documents, and average score
 */
export function NationalOverviewCards({ data, loading }) {
    const formatNumber = (num) => {
        return new Intl.NumberFormat('en-US').format(num);
    };
    return (_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsx(StatCard, { title: "Total Districts", value: data ? formatNumber(data.totalDistricts) : '-', subtitle: "US public school districts", icon: _jsx(Building2, { className: "h-6 w-6 text-primary" }), loading: loading }), _jsx(StatCard, { title: "Superintendent Coverage", value: data ? `${data.superintendentCoverage.percent}%` : '-', subtitle: data ? `${formatNumber(data.superintendentCoverage.count)} contacts` : undefined, icon: _jsx(Users, { className: "h-6 w-6 text-primary" }), loading: loading }), _jsx(StatCard, { title: "Documents Analyzed", value: data ? formatNumber(data.documentStats.totalDocuments) : '-', subtitle: "PDFs, strategic plans, & more", icon: _jsx(FileText, { className: "h-6 w-6 text-primary" }), loading: loading }), _jsx(StatCard, { title: "Average Score", value: data ? data.averageScores.total.toFixed(1) : '-', subtitle: "Across all scored districts", icon: _jsx(TrendingUp, { className: "h-6 w-6 text-primary" }), loading: loading })] }));
}
