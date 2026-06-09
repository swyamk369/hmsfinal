'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { apiGet, ApiError } from './api';
import { getFirebaseAuth } from './firebase';
import { getActiveMembership, landingPath } from './access';
import { clearActiveTenant, getStoredTenant, setStoredTenant } from './session';
import type { Membership, Profile } from './types';

// Re-exported for backward compatibility — the implementations live in ./access.
export { getActiveMembership, landingPath };

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  activeTenantId: string | null;
  activeMembership: Membership | null;
  firebaseLogin: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveTenant: (id: string) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const p = await apiGet<Profile>('/auth/me');
      setProfile(p);
      const stored = getStoredTenant();
      if (p.tenants.length) {
        const valid = p.tenants.find((t) => t.tenantId === stored);
        setActiveTenantId(valid?.tenantId ?? p.tenants[0].tenantId);
      } else {
        setActiveTenantId(null);
      }
      setError(null);
    } catch (e) {
      setProfile(null);
      setActiveTenantId(null);
      if (e instanceof ApiError && e.status !== 401) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setError('Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* in apps/web/.env.local.');
      setLoading(false);
      return;
    }
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (u) {
        await loadProfile();
      } else {
        setProfile(null);
        setActiveTenantId(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, [loadProfile]);

  const firebaseLogin = useCallback(
    async (email: string, password: string) => {
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error('Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* in apps/web/.env.local.');
      }
      await signInWithEmailAndPassword(auth, email, password);
      await loadProfile();
    },
    [loadProfile],
  );

  const resetPassword = useCallback(async (email: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase is not configured.');
    await sendPasswordResetEmail(auth, email);
  }, []);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    clearActiveTenant();
    setProfile(null);
    setActiveTenantId(null);
  }, []);

  const setActiveTenant = useCallback((id: string) => {
    setActiveTenantId(id);
    setStoredTenant(id);
  }, []);

  const value: AuthContextValue = {
    profile,
    loading,
    error,
    activeTenantId,
    activeMembership: getActiveMembership(profile, activeTenantId),
    firebaseLogin,
    resetPassword,
    logout,
    setActiveTenant,
    refresh: loadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
