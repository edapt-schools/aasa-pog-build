import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
export function TopBar() {
    const { user, logout } = useAuth();
    return (_jsx("div", { className: "bg-card border-b border-border", children: _jsxs("div", { className: "flex items-center justify-between px-6 py-3", children: [_jsx("div", { className: "flex items-center gap-3", children: _jsx("h1", { className: "text-xl font-semibold text-foreground", children: "AASA District Intelligence" }) }), _jsx("div", { className: "flex items-center gap-4", children: user && (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-sm text-foreground", children: user.email }), _jsx(Button, { variant: "outline", size: "sm", onClick: logout, children: "Sign Out" })] })) })] }) }));
}
