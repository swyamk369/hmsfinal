'use client';

import { useRouter } from 'next/navigation';
import { ShieldX } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui';

export default function TenantSuspendedPage() {
  const { logout } = useAuth();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-line bg-surface shadow-raised">
        <div className="h-1 w-full bg-danger" />
        <div className="px-8 py-10 text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-xl bg-danger-bg text-danger">
            <ShieldX className="h-8 w-8" />
          </div>
          <h1 className="text-headline-md text-ink">Hospital Access Suspended</h1>
          <p className="mx-auto mt-2 max-w-md text-body-md text-ink-muted">
            Your tenant account has been suspended by the platform administrator. Access to all clinical and operational
            modules is currently restricted.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <Button variant="ghost" onClick={onLogout}>
              Logout
            </Button>
            <a href="mailto:support@hms.example?subject=Hospital%20access%20suspended">
              <Button variant="dark">Contact Platform Support</Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
