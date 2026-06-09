'use client';

import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS } from '@/lib/constants';
import { PageHeader, StatCard, Badge } from './ui';

/** Shared role landing header: who you are, where you are, what's enabled. */
export default function RoleHome({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const { profile, activeMembership } = useAuth();
  const modules = activeMembership?.modules ?? [];
  const roles = activeMembership?.roles ?? [];

  return (
    <>
      <PageHeader title={title} subtitle={subtitle ?? `Welcome back, ${profile?.fullName ?? ''}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Hospital" value={activeMembership?.tenantName ?? '—'} hint={activeMembership?.status} />
        <StatCard label="Your roles" value={roles.map((r) => ROLE_LABELS[r] ?? r).join(', ') || '—'} />
        <StatCard label="Enabled modules" value={modules.length} />
      </div>
      {modules.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {modules.map((m) => (
            <Badge key={m} tone="blue">
              {m}
            </Badge>
          ))}
        </div>
      )}
      <div className="mt-6">{children}</div>
    </>
  );
}
