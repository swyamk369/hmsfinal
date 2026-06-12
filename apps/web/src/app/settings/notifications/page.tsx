'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save, SlidersHorizontal } from 'lucide-react';
import Protected from '@/components/Protected';
import { Button, EmptyState, ErrorState, FormField, Input, PageHeader, Section, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { notificationsApi, type NotificationPreference } from '@/lib/notifications';

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-body-sm text-ink-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
}

function PreferencesInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [rows, setRows] = useState<NotificationPreference[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    setLoading(true);
    try {
      setRows(await notificationsApi.preferences(t));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(category: string, change: Partial<NotificationPreference>) {
    setRows((prev) => prev.map((row) => (row.category === category ? { ...row, ...change } : row)));
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setSaved(null);
    try {
      setRows(await notificationsApi.updatePreferences(t, rows));
      setSaved('Notification preferences saved.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Notification Preferences"
        subtitle="Choose in-app and external delivery settings for each workflow category"
        action={
          <Button icon={Save} onClick={save} loading={saving} disabled={loading || rows.length === 0}>
            Save
          </Button>
        }
      />

      <div className="space-y-6">
        {err && <ErrorState message={err} />}
        {saved && (
          <div className="rounded-md border border-success/30 bg-success-bg px-4 py-3 text-body-sm text-success-fg">
            {saved}
          </div>
        )}
        {loading ? (
          <Spinner label="Loading preferences..." />
        ) : rows.length === 0 ? (
          <EmptyState icon={SlidersHorizontal} title="No preference categories" />
        ) : (
          <Section title="Categories">
            <div className="divide-y divide-line">
              {rows.map((row) => (
                <div key={row.category} className="grid gap-4 px-5 py-4 xl:grid-cols-[12rem_1fr_18rem]">
                  <div>
                    <div className="text-title-md text-ink">{row.category.replace(/_/g, ' ')}</div>
                    <div className="text-body-sm text-ink-soft">Tenant-scoped workflow alerts</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Toggle
                      checked={row.inAppEnabled}
                      onChange={(v) => patch(row.category, { inAppEnabled: v })}
                      label="In-app"
                    />
                    <Toggle
                      checked={row.emailEnabled}
                      onChange={(v) => patch(row.category, { emailEnabled: v })}
                      label="Email"
                    />
                    <Toggle
                      checked={row.smsEnabled}
                      onChange={(v) => patch(row.category, { smsEnabled: v })}
                      label="SMS"
                    />
                    <Toggle
                      checked={row.whatsappEnabled}
                      onChange={(v) => patch(row.category, { whatsappEnabled: v })}
                      label="WhatsApp"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Quiet start">
                      <Input
                        type="time"
                        value={row.quietHoursStart ?? ''}
                        onChange={(e) => patch(row.category, { quietHoursStart: e.target.value || null })}
                      />
                    </FormField>
                    <FormField label="Quiet end">
                      <Input
                        type="time"
                        value={row.quietHoursEnd ?? ''}
                        onChange={(e) => patch(row.category, { quietHoursEnd: e.target.value || null })}
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}

export default function NotificationPreferencesPage() {
  return (
    <Protected>
      <PreferencesInner />
    </Protected>
  );
}
