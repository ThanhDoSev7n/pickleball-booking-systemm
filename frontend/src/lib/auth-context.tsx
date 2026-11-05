'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearTokens, getRefreshToken, hasStoredSession, setTokens } from './api/client';
import { fetchMe, login as apiLogin, register as apiRegister, type AuthResult, type AuthUser, type RegisterPayload } from './api/auth-api';

const USER_KEY = 'datsanpick.user';

export type AuthStatus = 'loading' | 'authenticated' | 'guest';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isStaffOrOwner: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (payload: RegisterPayload) => Promise<AuthUser>;
  signOut: () => void;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function persistUser(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Khoi dong: co refreshToken thi goi /auth/me (interceptor tu refresh neu access token het han)
  useEffect(() => {
    let ignored = false;
    const boot = async () => {
      if (!hasStoredSession()) {
        setStatus('guest');
        return;
      }
      setUser(readStoredUser());
      try {
        const profile = await fetchMe();
        if (ignored) return;
        setUser(profile);
        persistUser(profile);
        setStatus('authenticated');
      } catch {
        if (ignored) return;
        clearTokens();
        persistUser(null);
        setUser(null);
        setStatus('guest');
      }
    };
    void boot();
    return () => {
      ignored = true;
    };
  }, []);

  const applyResult = useCallback((result: AuthResult) => {
    setTokens(result.tokens);
    setUser(result.user);
    persistUser(result.user);
    setStatus('authenticated');
    return result.user;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => applyResult(await apiLogin(email, password)),
    [applyResult],
  );

  const signUp = useCallback(
    async (payload: RegisterPayload) => applyResult(await apiRegister(payload)),
    [applyResult],
  );

  const signOut = useCallback(() => {
    clearTokens();
    persistUser(null);
    setUser(null);
    setStatus('guest');
  }, []);

  const reloadProfile = useCallback(async () => {
    if (!getRefreshToken()) {
      setStatus('guest');
      return;
    }
    try {
      const profile = await fetchMe();
      setUser(profile);
      persistUser(profile);
      setStatus('authenticated');
    } catch {
      signOut();
    }
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated' && Boolean(user),
      isStaffOrOwner: user?.role === 'STAFF' || user?.role === 'OWNER' || user?.role === 'ADMIN',
      signIn,
      signUp,
      signOut,
      reloadProfile,
    }),
    [user, status, signIn, signUp, signOut, reloadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phai duoc goi ben trong AuthProvider');
  return context;
}
