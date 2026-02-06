import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDistricts } from '../hooks/useDistricts';
import { FilterPanel } from '../components/FilterPanel';
import { DistrictGrid } from '../components/DistrictGrid';
import { PaginationControls } from '../components/PaginationControls';
import { DistrictDetailPanel } from '../components/DistrictDetailPanel';
import { ExportButton } from '../components/ExportButton';
import { Menu, X } from 'lucide-react';
import { Button } from '../components/ui/button';
export default function Discovery() {
    const { user, logout } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    // Mobile filter drawer state
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    // Selected district for detail panel
    const [selectedDistrictId, setSelectedDistrictId] = useState(null);
    // Initialize filters from URL query params
    const initializeFilters = useCallback(() => {
        const filters = {
            limit: parseInt(searchParams.get('limit') || '50'),
            offset: parseInt(searchParams.get('offset') || '0'),
        };
        // State filter (multi-select)
        const states = searchParams.getAll('state');
        if (states.length > 0)
            filters.state = states;
        // Enrollment range
        const enrollmentMin = searchParams.get('enrollmentMin');
        if (enrollmentMin)
            filters.enrollmentMin = parseInt(enrollmentMin);
        const enrollmentMax = searchParams.get('enrollmentMax');
        if (enrollmentMax)
            filters.enrollmentMax = parseInt(enrollmentMax);
        // Outreach tier (multi-select)
        const tiers = searchParams.getAll('tier');
        if (tiers.length > 0)
            filters.outreachTier = tiers;
        // Superintendent filter
        const hasSuperintendent = searchParams.get('hasSuperintendent');
        if (hasSuperintendent === 'true')
            filters.hasSuperintendent = true;
        if (hasSuperintendent === 'false')
            filters.hasSuperintendent = false;
        // Keyword score filters
        const readinessMin = searchParams.get('readinessMin');
        if (readinessMin)
            filters.readinessScoreMin = parseInt(readinessMin);
        const alignmentMin = searchParams.get('alignmentMin');
        if (alignmentMin)
            filters.alignmentScoreMin = parseInt(alignmentMin);
        const activationMin = searchParams.get('activationMin');
        if (activationMin)
            filters.activationScoreMin = parseInt(activationMin);
        const brandingMin = searchParams.get('brandingMin');
        if (brandingMin)
            filters.brandingScoreMin = parseInt(brandingMin);
        return filters;
    }, [searchParams]);
    const [filters, setFilters] = useState(initializeFilters);
    // Fetch districts with current filters
    const { data, loading, error } = useDistricts(filters);
    // Sync filters to URL query params
    useEffect(() => {
        const params = new URLSearchParams();
        // Pagination
        params.set('limit', filters.limit?.toString() || '50');
        params.set('offset', filters.offset?.toString() || '0');
        // States (multi-select)
        filters.state?.forEach((state) => params.append('state', state));
        // Enrollment
        if (filters.enrollmentMin)
            params.set('enrollmentMin', filters.enrollmentMin.toString());
        if (filters.enrollmentMax)
            params.set('enrollmentMax', filters.enrollmentMax.toString());
        // Tiers (multi-select)
        filters.outreachTier?.forEach((tier) => params.append('tier', tier));
        // Superintendent
        if (filters.hasSuperintendent !== undefined) {
            params.set('hasSuperintendent', filters.hasSuperintendent.toString());
        }
        // Keyword scores
        if (filters.readinessScoreMin)
            params.set('readinessMin', filters.readinessScoreMin.toString());
        if (filters.alignmentScoreMin)
            params.set('alignmentMin', filters.alignmentScoreMin.toString());
        if (filters.activationScoreMin)
            params.set('activationMin', filters.activationScoreMin.toString());
        if (filters.brandingScoreMin)
            params.set('brandingMin', filters.brandingScoreMin.toString());
        setSearchParams(params, { replace: true });
    }, [filters, setSearchParams]);
    // Handle filter changes
    const handleFilterChange = (newFilters) => {
        // Reset to page 1 when filters change
        setFilters({ ...newFilters, offset: 0 });
        // Close mobile drawer when filter applied
        setIsFilterDrawerOpen(false);
    };
    // Handle filter reset
    const handleFilterReset = () => {
        setFilters({ limit: 50, offset: 0 });
        setIsFilterDrawerOpen(false);
    };
    // Handle pagination
    const handlePageChange = (newOffset) => {
        setFilters({ ...filters, offset: newOffset });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleLimitChange = (newLimit) => {
        setFilters({ ...filters, limit: newLimit, offset: 0 });
    };
    // Handle district click
    const handleDistrictClick = (district) => {
        setSelectedDistrictId(district.ncesId);
    };
    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyboard = (e) => {
            // Don't trigger if user is typing in an input
            if (document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA' ||
                document.activeElement?.tagName === 'SELECT') {
                return;
            }
            // ESC - Close detail panel or filter drawer
            if (e.key === 'Escape') {
                if (selectedDistrictId) {
                    setSelectedDistrictId(null);
                }
                else if (isFilterDrawerOpen) {
                    setIsFilterDrawerOpen(false);
                }
            }
            // / - Focus search (future feature)
            if (e.key === '/' && !e.shiftKey) {
                e.preventDefault();
                // TODO: Focus search input when implemented
            }
        };
        document.addEventListener('keydown', handleKeyboard);
        return () => document.removeEventListener('keydown', handleKeyboard);
    }, [selectedDistrictId, isFilterDrawerOpen]);
    return (_jsxs("div", { className: "min-h-screen bg-background", children: [_jsx("header", { className: "sticky top-0 z-30 bg-background border-b border-border", children: _jsxs("div", { className: "flex items-center justify-between px-4 sm:px-6 py-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: () => setIsFilterDrawerOpen(!isFilterDrawerOpen), className: "lg:hidden", "aria-label": "Toggle filters", children: isFilterDrawerOpen ? _jsx(X, { className: "h-5 w-5" }) : _jsx(Menu, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl sm:text-2xl font-semibold text-foreground", children: "Discovery Mode" }), _jsx("p", { className: "text-sm text-muted-foreground hidden sm:block", children: "Find and filter districts for outreach" })] })] }), _jsxs("div", { className: "flex items-center gap-2 sm:gap-4", children: [_jsx(ExportButton, { data: data?.data, filename: "districts", label: "Export", size: "sm" }), _jsx("span", { className: "text-sm text-muted-foreground hidden md:block", children: user?.email }), _jsx("button", { onClick: logout, className: "px-3 sm:px-4 py-2 bg-card border border-border rounded-lg text-sm hover:bg-muted transition-colors", children: "Sign out" })] })] }) }), _jsxs("div", { className: "flex", children: [_jsx("aside", { className: "hidden lg:block w-80 border-r border-border h-[calc(100vh-73px)] sticky top-[73px] overflow-y-auto", children: _jsx("div", { className: "p-4", children: _jsx(FilterPanel, { filters: filters, onFilterChange: handleFilterChange, onReset: handleFilterReset }) }) }), isFilterDrawerOpen && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden", onClick: () => setIsFilterDrawerOpen(false), "aria-hidden": "true" }), _jsx("div", { className: "fixed left-0 top-[73px] bottom-0 w-80 bg-background border-r border-border z-50 overflow-y-auto lg:hidden", children: _jsx("div", { className: "p-4", children: _jsx(FilterPanel, { filters: filters, onFilterChange: handleFilterChange, onReset: handleFilterReset }) }) })] })), _jsx("main", { className: "flex-1 p-4 sm:p-6", role: "main", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("div", { className: "sr-only", role: "status", "aria-live": "polite", "aria-atomic": "true", children: [loading && 'Loading districts...', !loading && data && `Showing ${data.pagination.total} districts`] }), _jsx(DistrictGrid, { districts: data?.data || [], loading: loading, error: error, total: data?.pagination.total || 0, offset: filters.offset || 0, limit: filters.limit || 50, onDistrictClick: handleDistrictClick }), data && data.pagination.total > 0 && (_jsx(PaginationControls, { total: data.pagination.total, limit: filters.limit || 50, offset: filters.offset || 0, onPageChange: handlePageChange, onLimitChange: handleLimitChange }))] }) })] }), selectedDistrictId && (_jsx(DistrictDetailPanel, { ncesId: selectedDistrictId, onClose: () => setSelectedDistrictId(null) }))] }));
}
