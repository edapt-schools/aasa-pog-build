import { jsx as _jsx } from "react/jsx-runtime";
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { router } from './router';
export default function App() {
    return (_jsx(AuthProvider, { children: _jsx(RouterProvider, { router: router }) }));
}
