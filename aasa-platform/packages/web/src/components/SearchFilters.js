import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { X } from 'lucide-react';
// Common document types
const DOCUMENT_TYPES = [
    { value: 'strategic_plan', label: 'Strategic Plan' },
    { value: 'annual_report', label: 'Annual Report' },
    { value: 'board_policy', label: 'Board Policy' },
    { value: 'budget', label: 'Budget' },
    { value: 'curriculum', label: 'Curriculum' },
    { value: 'presentation', label: 'Presentation' },
    { value: 'newsletter', label: 'Newsletter' },
    { value: 'webpage', label: 'Webpage' },
    { value: 'other', label: 'Other' },
];
// US States (abbreviated)
const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];
/**
 * Search filters component for Grants Mode
 * Allows filtering by document type, date range, and state
 */
export function SearchFilters({ filters, onChange }) {
    const [localFilters, setLocalFilters] = useState(filters);
    // Handle document type toggle
    const handleDocumentTypeChange = (type, checked) => {
        const currentTypes = localFilters.documentType || [];
        const newTypes = checked
            ? [...currentTypes, type]
            : currentTypes.filter((t) => t !== type);
        const newFilters = {
            ...localFilters,
            documentType: newTypes.length > 0 ? newTypes : undefined,
        };
        setLocalFilters(newFilters);
        onChange(newFilters);
    };
    // Handle date change
    const handleDateChange = (field, value) => {
        const newFilters = {
            ...localFilters,
            [field]: value || undefined,
        };
        setLocalFilters(newFilters);
        onChange(newFilters);
    };
    // Handle state change
    const handleStateChange = (state) => {
        const newFilters = {
            ...localFilters,
            state: state || undefined,
        };
        setLocalFilters(newFilters);
        onChange(newFilters);
    };
    // Clear all filters
    const handleClearAll = () => {
        const emptyFilters = {};
        setLocalFilters(emptyFilters);
        onChange(emptyFilters);
    };
    // Count active filters
    const activeFilterCount = (localFilters.documentType?.length || 0) +
        (localFilters.dateFrom ? 1 : 0) +
        (localFilters.dateTo ? 1 : 0) +
        (localFilters.state ? 1 : 0);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-foreground", children: "Filters" }), activeFilterCount > 0 && (_jsxs(Button, { variant: "ghost", size: "sm", onClick: handleClearAll, className: "text-xs h-8 px-2", children: [_jsx(X, { className: "h-3 w-3 mr-1" }), "Clear (", activeFilterCount, ")"] }))] }), _jsxs("div", { className: "space-y-3", children: [_jsx(Label, { className: "text-sm font-medium", children: "Document Type" }), _jsx("div", { className: "max-h-64 overflow-y-auto space-y-2 pr-2", children: DOCUMENT_TYPES.map((type) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Checkbox, { id: `type-${type.value}`, checked: localFilters.documentType?.includes(type.value) || false, onCheckedChange: (checked) => handleDocumentTypeChange(type.value, checked === true) }), _jsx("label", { htmlFor: `type-${type.value}`, className: "text-sm cursor-pointer", children: type.label })] }, type.value))) })] }), _jsxs("div", { className: "space-y-3", children: [_jsx(Label, { className: "text-sm font-medium", children: "Crawled Date Range" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "dateFrom", className: "text-xs text-muted-foreground", children: "From" }), _jsx(Input, { id: "dateFrom", type: "date", value: localFilters.dateFrom || '', onChange: (e) => handleDateChange('dateFrom', e.target.value), className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "dateTo", className: "text-xs text-muted-foreground", children: "To" }), _jsx(Input, { id: "dateTo", type: "date", value: localFilters.dateTo || '', onChange: (e) => handleDateChange('dateTo', e.target.value), className: "mt-1" })] })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx(Label, { htmlFor: "state", className: "text-sm font-medium", children: "State" }), _jsxs("select", { id: "state", value: localFilters.state || '', onChange: (e) => handleStateChange(e.target.value), className: "w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm", children: [_jsx("option", { value: "", children: "All States" }), US_STATES.map((state) => (_jsx("option", { value: state, children: state }, state)))] })] }), activeFilterCount > 0 && (_jsxs("div", { className: "pt-4 border-t space-y-2", children: [_jsx(Label, { className: "text-xs font-medium text-muted-foreground", children: "Active Filters" }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [localFilters.documentType?.map((type) => {
                                const typeLabel = DOCUMENT_TYPES.find((t) => t.value === type)?.label || type;
                                return (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => handleDocumentTypeChange(type, false), className: "h-7 text-xs", children: [typeLabel, _jsx(X, { className: "h-3 w-3 ml-1" })] }, type));
                            }), localFilters.dateFrom && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => handleDateChange('dateFrom', ''), className: "h-7 text-xs", children: ["From: ", localFilters.dateFrom, _jsx(X, { className: "h-3 w-3 ml-1" })] })), localFilters.dateTo && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => handleDateChange('dateTo', ''), className: "h-7 text-xs", children: ["To: ", localFilters.dateTo, _jsx(X, { className: "h-3 w-3 ml-1" })] })), localFilters.state && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => handleStateChange(''), className: "h-7 text-xs", children: ["State: ", localFilters.state, _jsx(X, { className: "h-3 w-3 ml-1" })] }))] })] }))] }));
}
