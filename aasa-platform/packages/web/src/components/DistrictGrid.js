import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DistrictCard } from './DistrictCard';
import { EmptyState } from './EmptyState';
import { Card } from './ui/card';
/**
 * Skeleton loading card matching DistrictCard structure
 */
function SkeletonCard() {
    return (_jsxs(Card, { className: "bg-card rounded-lg border border-border animate-pulse", children: [_jsxs("div", { className: "border-b border-border p-4", children: [_jsx("div", { className: "h-6 bg-muted rounded w-3/4 mb-2" }), _jsx("div", { className: "h-4 bg-muted rounded w-1/2" })] }), _jsxs("div", { className: "p-4 space-y-3", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("div", { className: "h-4 bg-muted rounded w-1/3" }), _jsx("div", { className: "h-4 bg-muted rounded w-1/4" })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("div", { className: "h-4 bg-muted rounded w-1/3" }), _jsx("div", { className: "h-4 bg-muted rounded w-1/4" })] }), _jsxs("div", { className: "pt-2 border-t border-border", children: [_jsx("div", { className: "h-4 bg-muted rounded w-full mb-2" }), _jsx("div", { className: "h-4 bg-muted rounded w-2/3" })] })] })] }));
}
export function DistrictGrid({ districts, loading, error, total, offset, limit, onDistrictClick, }) {
    // Calculate result range
    const startResult = total > 0 ? offset + 1 : 0;
    const endResult = Math.min(offset + limit, total);
    // Show loading skeleton
    if (loading && districts.length === 0) {
        return (_jsxs("div", { children: [_jsx("div", { className: "text-sm text-muted-foreground mb-4", children: "Loading districts..." }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", children: Array.from({ length: 6 }).map((_, i) => (_jsx(SkeletonCard, {}, i))) })] }));
    }
    // Show error state
    if (error) {
        return (_jsx(EmptyState, { title: "Error Loading Districts", description: error, icon: "alert-circle" }));
    }
    // Show empty state
    if (districts.length === 0) {
        return (_jsx(EmptyState, { title: "No Districts Found", description: "Try adjusting your filters to see more results.", icon: "search" }));
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("p", { className: "text-sm text-muted-foreground", children: ["Showing ", startResult.toLocaleString(), "\u2013", endResult.toLocaleString(), " of", ' ', total.toLocaleString(), " districts"] }), loading && (_jsx("span", { className: "text-sm text-muted-foreground animate-pulse", children: "Updating..." }))] }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", children: districts.map((district) => (_jsx(DistrictCard, { district: district, onSelect: () => onDistrictClick(district) }, district.id))) })] }));
}
