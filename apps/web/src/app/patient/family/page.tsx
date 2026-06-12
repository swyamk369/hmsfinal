'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Plus, Trash2, Pencil, CalendarPlus, X } from 'lucide-react';
import { portalApi, type FamilyMember } from '@/lib/patient-portal';
import { Loading, EmptyState, ErrorState } from '@/components/patient/portal-ui';

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Other'];
const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-md text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';

interface FormState {
  fullName: string;
  relationship: string;
  dob: string;
  sex: string;
  mobile: string;
}
const EMPTY: FormState = { fullName: '', relationship: 'Child', dob: '', sex: '', mobile: '' };

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setMembers(await portalApi.family());
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(m: FamilyMember) {
    setEditing(m);
    setShowForm(true);
  }
  async function remove(id: string) {
    await portalApi.removeFamily(id).catch(() => {});
    await load();
  }

  if (err) return <ErrorState msg={err} />;
  if (!members) return <Loading label="Loading family profiles…" />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-headline-md text-ink">Family</h1>
          <p className="text-body-sm text-ink-muted">Manage family members and book appointments on their behalf.</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Add member
        </button>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No family members yet"
          body="Add a family member to manage their care and book appointments for them."
        />
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
              <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-primary-100 text-label-md font-semibold text-primary-700">
                {m.fullName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join('')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{m.fullName}</p>
                <p className="text-body-sm text-ink-muted">
                  {m.relationship}
                  {m.dob ? ` · ${new Date(m.dob).toLocaleDateString()}` : ''}
                  {m.sex ? ` · ${m.sex}` : ''}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <Link
                    href={`/doctors?bookFor=${m.id}&bookForName=${encodeURIComponent(m.fullName)}`}
                    className="inline-flex items-center gap-1 text-label-md font-medium text-primary hover:underline"
                  >
                    <CalendarPlus className="h-4 w-4" /> Book for this person
                  </Link>
                  <button
                    onClick={() => openEdit(m)}
                    className="inline-flex items-center gap-1 text-label-md text-ink-muted hover:text-ink"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                </div>
              </div>
              <button onClick={() => remove(m.id)} aria-label="Remove" className="text-ink-soft hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-label-sm text-ink-soft">
        Booking for a family member creates their record at the hospital you choose. Cross-hospital record aggregation
        for dependents isn’t available yet.
      </p>

      {showForm && <FamilyForm member={editing} onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function FamilyForm({
  member,
  onClose,
  onSaved,
}: {
  member: FamilyMember | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(
    member
      ? {
          fullName: member.fullName,
          relationship: member.relationship,
          dob: member.dob?.slice(0, 10) ?? '',
          sex: member.sex ?? '',
          mobile: member.mobile ?? '',
        }
      : EMPTY,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!form.fullName.trim()) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      fullName: form.fullName.trim(),
      relationship: form.relationship,
      dob: form.dob || undefined,
      sex: form.sex || undefined,
      mobile: form.mobile.trim() || undefined,
    };
    try {
      if (member) await portalApi.updateFamily(member.id, body);
      else await portalApi.addFamily(body);
      onClose();
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-sm text-ink">{member ? 'Edit family member' : 'Add family member'}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <div className="mb-3 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-label-md text-ink">Full name *</span>
            <input
              className={inputCls}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-label-md text-ink">Relationship</span>
              <select
                className={inputCls}
                value={form.relationship}
                onChange={(e) => setForm({ ...form, relationship: e.target.value })}
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-label-md text-ink">Date of birth</span>
              <input
                type="date"
                className={inputCls}
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-label-md text-ink">Sex</span>
              <select className={inputCls} value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                <option value="">—</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-label-md text-ink">Mobile</span>
              <input
                className={inputCls}
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-label-md font-medium text-ink hover:bg-canvas"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
