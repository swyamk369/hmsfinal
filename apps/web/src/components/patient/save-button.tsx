'use client';

import { useCallback, useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase';
import { portalApi, type SavedProvider, type SavedHospital } from '@/lib/patient-portal';

/**
 * Phase 23 — Heart/Save toggles for the public directory. These buttons let a signed-in
 * patient favorite a doctor or hospital from the public directory cards (unauthenticated
 * pages). Uses the PATIENT Firebase auth (not staff). If the patient is not signed in,
 * clicking shows a tooltip nudging them to sign in.
 *
 * Architecture: On mount, checks Firebase auth and (if signed in) loads the patient's
 * saved list ONCE. Builds an in-memory Set for O(1) lookup on every card. Toggles are
 * optimistic — the UI flips immediately and rolls back on error.
 */

// ── Global provider for the saved-items set ─────────────────────
// Shared across all heart buttons on a page — fetched exactly once.
let _savedDoctorIds: Set<string> | null = null;
let _savedHospitalTenants: Set<string> | null = null;
let _loadPromise: Promise<void> | null = null;
let _subscribers = new Set<() => void>();

function subscribe(fn: () => void) {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}
function notify() {
  _subscribers.forEach((fn) => fn());
}

async function ensureLoaded() {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    try {
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) return;
      const [providers, hospitals] = await Promise.all([portalApi.savedProviders(), portalApi.savedHospitals()]);
      _savedDoctorIds = new Set(providers.map((p) => `${p.tenantId}:${p.doctorId}`));
      _savedHospitalTenants = new Set(hospitals.map((h) => h.tenantId));
    } catch {
      // Non-critical — hearts just won't pre-fill
    }
  })();
  return _loadPromise;
}

function useSavedState() {
  const [, setTick] = useState(0);
  useEffect(() => {
    void ensureLoaded().then(() => setTick((t) => t + 1));
    const unsubscribe = subscribe(() => setTick((t) => t + 1));
    return () => {
      unsubscribe();
    };
  }, []);
  return { doctors: _savedDoctorIds, hospitals: _savedHospitalTenants };
}

// ── Save Doctor Button ──────────────────────────────────────────
interface SaveDoctorProps {
  tenantId: string;
  doctorId: string;
  doctorSlug?: string | null;
  doctorName: string;
  specialty?: string | null;
  hospitalName: string;
  photoUrl?: string | null;
  className?: string;
}

export function SaveDoctorButton({
  tenantId,
  doctorId,
  doctorSlug,
  doctorName,
  specialty,
  hospitalName,
  photoUrl,
  className = '',
}: SaveDoctorProps) {
  const { doctors } = useSavedState();
  const key = `${tenantId}:${doctorId}`;
  const isSaved = doctors?.has(key) ?? false;
  const [busy, setBusy] = useState(false);
  const [tooltip, setTooltip] = useState(false);

  const toggle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      setTooltip(true);
      setTimeout(() => setTooltip(false), 2500);
      return;
    }
    if (busy) return;
    setBusy(true);

    // Optimistic toggle
    if (isSaved) {
      _savedDoctorIds?.delete(key);
      notify();
      try {
        const list = await portalApi.savedProviders();
        const match = list.find((p) => p.tenantId === tenantId && p.doctorId === doctorId);
        if (match) await portalApi.removeSavedProvider(match.id);
      } catch {
        _savedDoctorIds?.add(key);
        notify();
      }
    } else {
      _savedDoctorIds ??= new Set();
      _savedDoctorIds.add(key);
      notify();
      try {
        await portalApi.saveProvider({
          tenantId,
          doctorId,
          doctorSlug: doctorSlug ?? undefined,
          doctorName,
          specialty: specialty ?? undefined,
          hospitalName,
          photoUrl: photoUrl ?? undefined,
        });
      } catch {
        _savedDoctorIds?.delete(key);
        notify();
      }
    }
    setBusy(false);
  }, [busy, isSaved, key, tenantId, doctorId, doctorSlug, doctorName, specialty, hospitalName, photoUrl]);

  return (
    <span className={`relative ${className}`}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void toggle();
        }}
        disabled={busy}
        aria-label={isSaved ? 'Remove from care team' : 'Save to care team'}
        className={`rounded-full p-1.5 transition-all ${
          isSaved ? 'text-red-500 hover:text-red-600' : 'text-ink-soft hover:text-red-400'
        } ${busy ? 'opacity-50' : ''}`}
      >
        <Heart className={`h-5 w-5 transition-all ${isSaved ? 'fill-current' : ''}`} />
      </button>
      {tooltip && (
        <span className="absolute -bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-label-sm text-white shadow-lg">
          Sign in to save
        </span>
      )}
    </span>
  );
}

// ── Save Hospital Button ────────────────────────────────────────
interface SaveHospitalProps {
  tenantId: string;
  hospitalSlug?: string | null;
  hospitalName: string;
  city?: string | null;
  logoUrl?: string | null;
  className?: string;
}

export function SaveHospitalButton({
  tenantId,
  hospitalSlug,
  hospitalName,
  city,
  logoUrl,
  className = '',
}: SaveHospitalProps) {
  const { hospitals } = useSavedState();
  const isSaved = hospitals?.has(tenantId) ?? false;
  const [busy, setBusy] = useState(false);
  const [tooltip, setTooltip] = useState(false);

  const toggle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      setTooltip(true);
      setTimeout(() => setTooltip(false), 2500);
      return;
    }
    if (busy) return;
    setBusy(true);

    if (isSaved) {
      _savedHospitalTenants?.delete(tenantId);
      notify();
      try {
        const list = await portalApi.savedHospitals();
        const match = list.find((h) => h.tenantId === tenantId);
        if (match) await portalApi.removeSavedHospital(match.id);
      } catch {
        _savedHospitalTenants?.add(tenantId);
        notify();
      }
    } else {
      _savedHospitalTenants ??= new Set();
      _savedHospitalTenants.add(tenantId);
      notify();
      try {
        await portalApi.saveHospital({
          tenantId,
          hospitalSlug: hospitalSlug ?? undefined,
          hospitalName,
          city: city ?? undefined,
          logoUrl: logoUrl ?? undefined,
        });
      } catch {
        _savedHospitalTenants?.delete(tenantId);
        notify();
      }
    }
    setBusy(false);
  }, [busy, isSaved, tenantId, hospitalSlug, hospitalName, city, logoUrl]);

  return (
    <span className={`relative ${className}`}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void toggle();
        }}
        disabled={busy}
        aria-label={isSaved ? 'Remove from saved hospitals' : 'Save hospital'}
        className={`rounded-full p-1.5 transition-all ${
          isSaved ? 'text-red-500 hover:text-red-600' : 'text-ink-soft hover:text-red-400'
        } ${busy ? 'opacity-50' : ''}`}
      >
        <Heart className={`h-5 w-5 transition-all ${isSaved ? 'fill-current' : ''}`} />
      </button>
      {tooltip && (
        <span className="absolute -bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-label-sm text-white shadow-lg">
          Sign in to save
        </span>
      )}
    </span>
  );
}
