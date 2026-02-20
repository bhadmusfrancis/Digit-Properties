import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AuthUser } from '../lib/auth-storage';
import { clearAuth, getStoredToken, getStoredUser, setAuth as persistAuth } from '../lib/auth-storage';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  isLoaded: boolean;
};

type AuthContextValue = AuthState & {
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, user: null, isLoaded: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, user] = await Promise.all([getStoredToken(), getStoredUser()]);
      if (!cancelled) setState({ token, user, isLoaded: true });
    })();
    return () => { cancelled = true; };
  }, []);

  const setAuth = useCallback(async (token: string, user: AuthUser) => {
    await persistAuth(token, user);
    setState({ token, user, isLoaded: true });
  }, []);

  const signOut = useCallback(async () => {
    await clearAuth();
    setState({ token: null, user: null, isLoaded: true });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, setAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
