'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { adminApi, type HospitalProfile } from '@/lib/admin';
import { Button, FormField, Input, Select, PageHeader, Section, Spinner, ErrorState } from '@/components/ui';

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

function ProfileForm() {
  const { activeTenantId } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState<HospitalProfile | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setLoadErr(null);
    try {
      setForm(await adminApi.getProfile(activeTenantId));
    } catch (e) {
      setLoadErr((e as Error).message);
    }
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof HospitalProfile>(key: K, value: HospitalProfile[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function validate(f: HospitalProfile): boolean {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Hospital name is required.';
    if (f.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contactEmail)) e.contactEmail = 'Enter a valid email.';
    if (!f.invoicePrefix.trim()) e.invoicePrefix = 'Invoice prefix is required.';
    if (!f.mrnPrefix.trim()) e.mrnPrefix = 'MRN prefix is required.';
    setFieldErr(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!form || !activeTenantId || !validate(form)) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateProfile(activeTenantId, {
        name: form.name.trim(),
        contactEmail: form.contactEmail ?? '',
        contactPhone: form.contactPhone ?? '',
        address: form.address ?? '',
        timezone: form.timezone,
        currency: form.currency,
        invoicePrefix: form.invoicePrefix.trim(),
        mrnPrefix: form.mrnPrefix.trim(),
      });
      setForm(updated);
      toast.success('Hospital profile saved.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Hospital Profile" subtitle="Identity, contact, and document defaults" />
      <AdminTabs />

      {loadErr && <ErrorState message={loadErr} />}
      {!form && !loadErr && <Spinner label="Loading profile…" />}

      {form && (
        <Section
          title="Profile"
          action={
            <Button icon={Save} onClick={save} loading={saving}>
              Save changes
            </Button>
          }
        >
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
            <FormField label="Hospital name" required error={fieldErr.name}>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="CareCore Hospital" />
            </FormField>
            <FormField label="Contact email" error={fieldErr.contactEmail}>
              <Input
                type="email"
                value={form.contactEmail ?? ''}
                onChange={(e) => set('contactEmail', e.target.value)}
                placeholder="admin@hospital.org"
              />
            </FormField>
            <FormField label="Phone">
              <Input
                value={form.contactPhone ?? ''}
                onChange={(e) => set('contactPhone', e.target.value)}
                placeholder="+91 80 4000 0000"
              />
            </FormField>
            <FormField label="Address">
              <Input
                value={form.address ?? ''}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Street, City, State"
              />
            </FormField>
            <FormField label="Timezone">
              <Select value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Currency">
              <Select value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Invoice prefix"
              required
              error={fieldErr.invoicePrefix}
              hint="Used on invoice numbers, e.g. INV-0001"
            >
              <Input
                value={form.invoicePrefix}
                onChange={(e) => set('invoicePrefix', e.target.value)}
                placeholder="INV"
              />
            </FormField>
            <FormField label="MRN prefix" required error={fieldErr.mrnPrefix} hint="Used on patient record numbers">
              <Input value={form.mrnPrefix} onChange={(e) => set('mrnPrefix', e.target.value)} placeholder="MRN" />
            </FormField>
          </div>
        </Section>
      )}
    </>
  );
}

export default function ProfilePage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']}>
      <ProfileForm />
    </Protected>
  );
}
