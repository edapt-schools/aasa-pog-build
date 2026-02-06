import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
export function AppLayout() {
    return (_jsxs("div", { className: "flex flex-col h-screen bg-background", children: [_jsx(TopBar, {}), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsx(Sidebar, {}), _jsx("main", { className: "flex-1 overflow-auto", children: _jsx("div", { className: "container mx-auto p-6", children: _jsx(Outlet, {}) }) })] })] }));
}
