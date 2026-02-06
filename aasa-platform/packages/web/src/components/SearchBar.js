import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Input } from './ui/input';
import { Button } from './ui/button';
export function SearchBar({ value, onChange, onSearch, placeholder = 'Search districts...', isLoading = false, className = '', }) {
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            onSearch();
        }
    };
    return (_jsxs("div", { className: `flex gap-2 ${className}`, children: [_jsx(Input, { type: "text", value: value, onChange: (e) => onChange(e.target.value), onKeyPress: handleKeyPress, placeholder: placeholder, className: "flex-1", disabled: isLoading }), _jsx(Button, { onClick: onSearch, disabled: isLoading || !value.trim(), children: isLoading ? 'Searching...' : 'Search' })] }));
}
