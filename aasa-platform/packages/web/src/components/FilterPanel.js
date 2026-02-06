import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardHeader, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { X } from 'lucide-react';
const US_STATES = [
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY',
];
export function FilterPanel({ filters, onFilterChange, onReset }) {
    // Count active filters
    const activeFilterCount = [
        filters.state?.length,
        filters.enrollmentMin || filters.enrollmentMax,
        filters.outreachTier?.length,
        filters.hasSuperintendent !== undefined,
        filters.readinessScoreMin,
        filters.alignmentScoreMin,
        filters.activationScoreMin,
        filters.brandingScoreMin,
    ].filter(Boolean).length;
    const hasActiveFilters = activeFilterCount > 0;
    // Helper to toggle state selection
    const toggleState = (stateCode) => {
        const currentStates = filters.state || [];
        const newStates = currentStates.includes(stateCode)
            ? currentStates.filter((s) => s !== stateCode)
            : [...currentStates, stateCode];
        onFilterChange({
            ...filters,
            state: newStates.length > 0 ? newStates : undefined,
        });
    };
    return (_jsxs(Card, { className: "bg-card border border-border", children: [_jsx(CardHeader, { className: "border-b border-border p-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "text-lg font-semibold text-foreground", children: "Filters" }), activeFilterCount > 0 && (_jsx(Badge, { variant: "secondary", className: "text-xs", children: activeFilterCount }))] }), hasActiveFilters && (_jsx(Button, { variant: "ghost", size: "sm", onClick: onReset, children: "Reset" }))] }) }), _jsxs(CardContent, { className: "p-4 space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "text-sm font-medium text-foreground mb-2 block", children: ["State ", filters.state && filters.state.length > 0 && `(${filters.state.length})`] }), _jsx("div", { className: "max-h-48 overflow-y-auto space-y-1 border border-border rounded-md p-2 bg-background", children: US_STATES.map((state) => (_jsxs("label", { className: "flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer", children: [_jsx(Checkbox, { checked: filters.state?.includes(state) || false, onCheckedChange: () => toggleState(state) }), _jsx("span", { className: "text-sm text-foreground", children: state })] }, state))) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-foreground mb-2 block", children: "Enrollment Range" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { type: "number", placeholder: "Min", value: filters.enrollmentMin || '', onChange: (e) => onFilterChange({
                                            ...filters,
                                            enrollmentMin: e.target.value ? parseInt(e.target.value) : undefined,
                                        }) }), _jsx(Input, { type: "number", placeholder: "Max", value: filters.enrollmentMax || '', onChange: (e) => onFilterChange({
                                            ...filters,
                                            enrollmentMax: e.target.value ? parseInt(e.target.value) : undefined,
                                        }) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-foreground mb-2 block", children: "Outreach Tier" }), _jsx("div", { className: "flex gap-2", children: ['tier1', 'tier2', 'tier3'].map((tier) => {
                                    const isSelected = filters.outreachTier?.includes(tier) || false;
                                    return (_jsx(Badge, { variant: isSelected ? 'default' : 'outline', className: "cursor-pointer", onClick: () => {
                                            const currentTiers = filters.outreachTier || [];
                                            const newTiers = isSelected
                                                ? currentTiers.filter((t) => t !== tier)
                                                : [...currentTiers, tier];
                                            onFilterChange({
                                                ...filters,
                                                outreachTier: newTiers.length > 0 ? newTiers : undefined,
                                            });
                                        }, children: tier.toUpperCase() }, tier));
                                }) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-foreground mb-2 block", children: "Superintendent Data" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: filters.hasSuperintendent === true ? 'default' : 'outline', size: "sm", onClick: () => onFilterChange({
                                            ...filters,
                                            hasSuperintendent: filters.hasSuperintendent === true ? undefined : true,
                                        }), children: "Has Contact" }), _jsx(Button, { variant: filters.hasSuperintendent === false ? 'default' : 'outline', size: "sm", onClick: () => onFilterChange({
                                            ...filters,
                                            hasSuperintendent: filters.hasSuperintendent === false ? undefined : false,
                                        }), children: "Missing Contact" })] })] }), _jsxs("div", { className: "border-t border-border pt-4 space-y-4", children: [_jsx("h4", { className: "text-sm font-medium text-foreground", children: "Keyword Scores (Min)" }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("label", { className: "text-sm text-muted-foreground", children: "Readiness" }), _jsx("span", { className: "text-sm font-medium text-foreground", children: filters.readinessScoreMin || 0 })] }), _jsx("input", { type: "range", min: "0", max: "100", step: "5", value: filters.readinessScoreMin || 0, onChange: (e) => onFilterChange({
                                            ...filters,
                                            readinessScoreMin: parseInt(e.target.value) || undefined,
                                        }), className: "w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600" })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("label", { className: "text-sm text-muted-foreground", children: "Alignment" }), _jsx("span", { className: "text-sm font-medium text-foreground", children: filters.alignmentScoreMin || 0 })] }), _jsx("input", { type: "range", min: "0", max: "100", step: "5", value: filters.alignmentScoreMin || 0, onChange: (e) => onFilterChange({
                                            ...filters,
                                            alignmentScoreMin: parseInt(e.target.value) || undefined,
                                        }), className: "w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-600" })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("label", { className: "text-sm text-muted-foreground", children: "Activation" }), _jsx("span", { className: "text-sm font-medium text-foreground", children: filters.activationScoreMin || 0 })] }), _jsx("input", { type: "range", min: "0", max: "100", step: "5", value: filters.activationScoreMin || 0, onChange: (e) => onFilterChange({
                                            ...filters,
                                            activationScoreMin: parseInt(e.target.value) || undefined,
                                        }), className: "w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-cyan-600" })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("label", { className: "text-sm text-muted-foreground", children: "Branding" }), _jsx("span", { className: "text-sm font-medium text-foreground", children: filters.brandingScoreMin || 0 })] }), _jsx("input", { type: "range", min: "0", max: "100", step: "5", value: filters.brandingScoreMin || 0, onChange: (e) => onFilterChange({
                                            ...filters,
                                            brandingScoreMin: parseInt(e.target.value) || undefined,
                                        }), className: "w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-amber-600" })] })] }), hasActiveFilters && (_jsxs("div", { className: "border-t border-border pt-4", children: [_jsx("label", { className: "text-sm font-medium text-foreground mb-2 block", children: "Active Filters" }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [filters.state?.map((state) => (_jsxs(Badge, { variant: "secondary", className: "cursor-pointer hover:bg-destructive hover:text-white", onClick: () => {
                                            const newStates = (filters.state || []).filter((s) => s !== state);
                                            onFilterChange({
                                                ...filters,
                                                state: newStates.length > 0 ? newStates : undefined,
                                            });
                                        }, children: [state, _jsx(X, { className: "ml-1 h-3 w-3" })] }, state))), filters.outreachTier?.map((tier) => (_jsxs(Badge, { variant: "secondary", className: "cursor-pointer hover:bg-destructive hover:text-white", onClick: () => {
                                            const newTiers = (filters.outreachTier || []).filter((t) => t !== tier);
                                            onFilterChange({
                                                ...filters,
                                                outreachTier: newTiers.length > 0 ? newTiers : undefined,
                                            });
                                        }, children: [tier.toUpperCase(), _jsx(X, { className: "ml-1 h-3 w-3" })] }, tier))), (filters.enrollmentMin || filters.enrollmentMax) && (_jsxs(Badge, { variant: "secondary", className: "cursor-pointer hover:bg-destructive hover:text-white", onClick: () => onFilterChange({
                                            ...filters,
                                            enrollmentMin: undefined,
                                            enrollmentMax: undefined,
                                        }), children: ["Enrollment", _jsx(X, { className: "ml-1 h-3 w-3" })] }))] })] }))] })] }));
}
