'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, landingPath } from '@/lib/auth-context';

export default function Home() {
  const { profile, loading, activeTenantId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(profile ? landingPath(profile, activeTenantId) : '/login');
  }, [loading, profile, activeTenantId, router]);

  return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading…</div>;
}
