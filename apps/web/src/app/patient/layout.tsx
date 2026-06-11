'use client';

import { usePathname } from 'next/navigation';
import { PortalShell } from '@/components/patient/portal-shell';

// Routes that manage their own full-screen chrome (no portal shell / auth gate).
const BARE = ['/patient/login', '/patient/register'];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // `/patient` itself only redirects to the dashboard — render it bare too.
  if (pathname === '/patient' || BARE.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }
  return <PortalShell>{children}</PortalShell>;
}
