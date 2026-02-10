import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
import { Badge } from '../ui/badge';
const sidebarItems = [
    {
        path: '/command',
        label: 'AI Command Center',
        icon: (_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" }) })),
    },
    {
        path: '/discovery',
        label: 'Discovery Mode',
        icon: (_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) })),
    },
    {
        path: '/grants',
        label: 'Grants Mode',
        icon: (_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) })),
    },
    {
        path: '/insights',
        label: 'Insights Mode',
        icon: (_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }) })),
    },
];
export function Sidebar() {
    return (_jsxs("div", { className: "w-64 bg-card border-r border-border flex flex-col", children: [_jsx("div", { className: "p-6", children: _jsx("h2", { className: "text-sm font-semibold text-muted-foreground uppercase tracking-wide", children: "Modes" }) }), _jsx("nav", { className: "flex-1 px-3 space-y-1", children: sidebarItems.map((item) => (_jsxs(NavLink, { to: item.path, className: ({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${item.disabled
                        ? 'opacity-50 cursor-not-allowed pointer-events-none'
                        : isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}`, children: [item.icon, _jsx("span", { className: "flex-1", children: item.label }), item.disabled && (_jsx(Badge, { variant: "secondary", className: "text-xs", children: "Soon" }))] }, item.path))) }), _jsx("div", { className: "p-4 border-t border-border", children: _jsxs("div", { className: "text-xs text-muted-foreground", children: [_jsx("p", { className: "font-medium mb-1", children: "AI-First vNext" }), _jsx("p", { children: "19,595 districts loaded" }), _jsx("p", { children: "83k+ document embeddings" })] }) })] }));
}
