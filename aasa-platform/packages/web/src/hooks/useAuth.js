import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
const AuthContext = createContext(undefined);
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
// Initialize Supabase client
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // Check authentication status
    const checkAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Store session in backend
                await fetch(`${API_URL}/api/auth/session`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: session.user.id,
                        email: session.user.email,
                    }),
                });
                setUser({
                    userId: session.user.id,
                    email: session.user.email || '',
                });
            }
            else {
                setUser(null);
            }
        }
        catch (error) {
            console.error('Auth check failed:', error);
            setUser(null);
        }
        finally {
            setLoading(false);
        }
    };
    // Login - use Supabase client-side OAuth
    const login = async (provider = 'google') => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: `${window.location.origin}/discovery`,
                },
            });
            if (error)
                throw error;
        }
        catch (error) {
            console.error('Login error:', error);
        }
    };
    // Logout
    const logout = async () => {
        try {
            await supabase.auth.signOut();
            await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            setUser(null);
            window.location.href = '/login';
        }
        catch (error) {
            console.error('Logout failed:', error);
        }
    };
    // Check auth on mount
    useEffect(() => {
        checkAuth();
    }, []);
    return (_jsx(AuthContext.Provider, { value: { user, loading, login, logout, checkAuth }, children: children }));
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
