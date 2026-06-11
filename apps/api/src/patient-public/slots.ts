/**
 * Phase 22.4 — Pure slot-generation engine (no DB). Computes bookable time slots for
 * a doctor on a given date from recurring availability rules + one-off overrides +
 * already-booked counts + the tenant booking policy (notice/advance windows).
 */

export interface SlotRule {
  dayOfWeek: number; // 0=Sun … 6=Sat
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  slotDurationMinutes: number;
  bufferMinutes: number;
  maxBookingsPerSlot: number;
  isActive: boolean;
}

export interface SlotOverride {
  date: string; // yyyy-mm-dd
  type: 'UNAVAILABLE' | 'EXTRA_AVAILABLE' | 'BLOCKED';
  startTime?: string | null;
  endTime?: string | null;
}

export interface SlotPolicy {
  minimumBookingNoticeHours: number;
  maximumBookingAdvanceDays: number;
  /** Appointment duration (overrides rule slot size when provided). */
  durationMinutes?: number;
}

export interface Slot {
  time: string; // "09:15"
  available: boolean;
}

export const timeToMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const minToTime = (mins: number): string =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export const dateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** The calendar date (yyyy-mm-dd) of an instant as seen in a timezone (local when omitted). */
export function dateKeyInTz(d: Date, timeZone?: string): string {
  if (!timeZone) return dateKey(d);
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** The wall-clock time (HH:mm) of an instant as seen in a timezone (local when omitted). */
export function timeKeyInTz(d: Date, timeZone?: string): string {
  if (!timeZone) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  return `${m.hour === '24' ? '00' : m.hour}:${m.minute}`;
}

/**
 * The UTC instant (epoch ms) whose wall-clock in `timeZone` equals the given date+time.
 * Uses the actual tz offset at that date (DST-correct). Local time when timeZone omitted.
 */
export function wallClockToInstant(dateKeyStr: string, timeStr: string, timeZone?: string): number {
  const [y, mo, d] = dateKeyStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  if (!timeZone) return new Date(y, mo - 1, d, h, mi).getTime();
  const asUTC = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(asUTC));
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const tzAsUTC = Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day), m.hour === '24' ? 0 : Number(m.hour), Number(m.minute), Number(m.second));
  return asUTC - (tzAsUTC - asUTC);
}

const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Build candidate start times in [startMin, endMin) given a step and a slot length. */
function buildWindow(startMin: number, endMin: number, step: number, slotLen: number): number[] {
  const out: number[] = [];
  for (let t = startMin; t + slotLen <= endMin; t += step) out.push(t);
  return out;
}

/**
 * Generate the slots for a single date. `bookedCounts` maps "HH:mm" → number of
 * appointments already booked at that start time for this doctor on this date.
 */
export function daySlots(params: {
  date: Date;
  rules: SlotRule[];
  overrides: SlotOverride[];
  bookedCounts: Record<string, number>;
  policy: SlotPolicy;
  now: Date;
  timeZone?: string;
}): Slot[] {
  const { date, rules, overrides, bookedCounts, policy, now, timeZone } = params;
  const day = startOfDay(date);
  const key = dateKey(day);

  // Past/advance windows are evaluated in the hospital timezone (calendar-day compare).
  if (key < dateKeyInTz(now, timeZone)) return [];
  if (key > dateKeyInTz(new Date(now.getTime() + policy.maximumBookingAdvanceDays * 86400000), timeZone)) return [];

  const dateOverrides = overrides.filter((o) => o.date === key);
  // A whole-day block/unavailable (no times) clears the day.
  if (dateOverrides.some((o) => (o.type === 'UNAVAILABLE' || o.type === 'BLOCKED') && !o.startTime)) return [];

  const dow = day.getDay();
  const dayRules = rules.filter((r) => r.isActive && r.dayOfWeek === dow);

  const starts = new Set<number>();
  const slotMeta = new Map<number, { len: number; max: number }>();
  const addWindow = (startMin: number, endMin: number, slotLen: number, buffer: number, max: number) => {
    for (const t of buildWindow(startMin, endMin, slotLen + buffer, slotLen)) {
      starts.add(t);
      if (!slotMeta.has(t)) slotMeta.set(t, { len: slotLen, max });
    }
  };

  for (const r of dayRules) {
    const len = policy.durationMinutes || r.slotDurationMinutes;
    addWindow(timeToMin(r.startTime), timeToMin(r.endTime), len, r.bufferMinutes, Math.max(1, r.maxBookingsPerSlot));
  }
  // EXTRA_AVAILABLE overrides add slots.
  for (const o of dateOverrides) {
    if (o.type === 'EXTRA_AVAILABLE' && o.startTime && o.endTime) {
      addWindow(timeToMin(o.startTime), timeToMin(o.endTime), policy.durationMinutes || 15, 0, 1);
    }
  }
  // Timed UNAVAILABLE/BLOCKED overrides remove overlapping start times.
  const blocked: Array<[number, number]> = dateOverrides
    .filter((o) => (o.type === 'UNAVAILABLE' || o.type === 'BLOCKED') && o.startTime && o.endTime)
    .map((o) => [timeToMin(o.startTime!), timeToMin(o.endTime!)] as [number, number]);

  const noticeCutoff = now.getTime() + policy.minimumBookingNoticeHours * 3600000;

  return [...starts]
    .filter((t) => !blocked.some(([bs, be]) => t >= bs && t < be))
    .sort((a, b) => a - b)
    .map((t) => {
      const time = minToTime(t);
      const meta = slotMeta.get(t)!;
      const withinNotice = wallClockToInstant(key, time, timeZone) >= noticeCutoff;
      const free = (bookedCounts[time] ?? 0) < meta.max;
      return { time, available: withinNotice && free };
    });
}
