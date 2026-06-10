/**
 * Phase 21.1 — Per-diem bed/room charge engine (pure, no DB).
 *
 * Given an admission, its bed-transfer history, and the per-ward daily rates, this
 * computes how many calendar days to bill for each ward and at what rate — accruing
 * idempotently against a watermark (`bedChargedThrough`) so it can be run repeatedly
 * (interim AND at discharge, or nightly) without ever double-charging.
 *
 * Day convention: CALENDAR_DAY (midnight census). Each calendar date the patient
 * occupied a bed is charged once, to the ward occupied at the last moment of that
 * date (so the destination ward of a same-day transfer owns that date). Admission and
 * discharge days are toggled by policy; a per-tenant minimum applies at discharge.
 *
 * NOTE on timezone: calendar dates are computed in the server's local time, matching
 * the rest of the finance code (e.g. day-close `dayRange`). Deploy the API in the
 * hospital's timezone. A tenant-timezone refinement is tracked for a later phase.
 */

/** Per-tenant IPD bed-charge policy, sourced from HospitalSettings. */
export interface BedChargePolicy {
  /** Day-counting basis. Only 'CALENDAR_DAY' is implemented today. */
  dayBasis: string;
  /** Count the admission calendar date. */
  chargeAdmissionDay: boolean;
  /** Count the discharge calendar date. */
  chargeDischargeDay: boolean;
  /** Minimum chargeable days for a stay; applied once, at the first (final) accrual. */
  minUnits: number;
}

/** A ward's billing rate. */
export interface WardRate {
  wardId: string;
  wardName: string;
  /** Per-day tariff in minor units (paise). */
  dailyRate: number;
  chargeCatalogId: string | null;
}

/** The minimal admission shape the engine needs. */
export interface AdmissionLite {
  /** Current/last bed. */
  bedId: string;
  admittedAt: Date;
  dischargedAt: Date | null;
  /** Watermark: bed charges already accrued through this date (00:00). */
  bedChargedThrough: Date | null;
}

/** The minimal bed-transfer shape the engine needs. */
export interface BedTransferLite {
  fromBedId: string;
  toBedId: string;
  transferredAt: Date;
}

/** A half-open bed occupancy interval [start, end). */
export interface OccupancySegment {
  bedId: string;
  start: Date;
  end: Date;
}

/** One ward's bed-charge line for this accrual run. */
export interface BedChargeLine {
  wardId: string;
  wardName: string;
  catalogId: string | null;
  /** First charged calendar date for this ward (yyyy-mm-dd). */
  fromDate: string;
  /** Last charged calendar date for this ward (yyyy-mm-dd). */
  toDate: string;
  /** Number of calendar days. */
  units: number;
  /** Ward daily rate, minor units. */
  unitPrice: number;
  /** units * unitPrice. */
  total: number;
}

export interface BedChargePlan {
  lines: BedChargeLine[];
  /** New watermark (00:00 of the last settled date), or the prior value if nothing new. */
  chargedThrough: Date | null;
  totalUnits: number;
  totalAmount: number;
}

export interface PlanInput {
  admission: AdmissionLite;
  transfers: BedTransferLite[];
  /** Rate for every bed that appears in the stay, keyed by bedId. */
  wardByBedId: Map<string, WardRate>;
  policy: BedChargePolicy;
  /** "As of" instant: discharge time at final accrual, or now() for an interim run. */
  asOf: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** yyyy-mm-dd in local time. */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Build a policy object from HospitalSettings (with safe defaults). */
export function bedChargePolicyFromSettings(s?: {
  ipdDayBasis?: string | null;
  ipdChargeAdmissionDay?: boolean | null;
  ipdChargeDischargeDay?: boolean | null;
  ipdMinUnits?: number | null;
}): BedChargePolicy {
  return {
    dayBasis: s?.ipdDayBasis ?? 'CALENDAR_DAY',
    chargeAdmissionDay: s?.ipdChargeAdmissionDay ?? true,
    chargeDischargeDay: s?.ipdChargeDischargeDay ?? false,
    minUnits: s?.ipdMinUnits ?? 1,
  };
}

/**
 * Reconstruct the contiguous bed-occupancy timeline from the admission's starting
 * bed and its ordered transfer history, ending at `end`.
 */
export function buildOccupancySegments(
  admission: AdmissionLite,
  transfers: BedTransferLite[],
  end: Date,
): OccupancySegment[] {
  const sorted = [...transfers]
    .filter((t) => t.transferredAt > admission.admittedAt && t.transferredAt < end)
    .sort((a, b) => a.transferredAt.getTime() - b.transferredAt.getTime());

  // The first bed of the stay is the origin of the first transfer; with no transfers,
  // the admission's current bed is the only bed.
  const initialBed = sorted.length ? sorted[0].fromBedId : admission.bedId;
  const segments: OccupancySegment[] = [];
  let cursorStart = admission.admittedAt;
  let cursorBed = initialBed;
  for (const t of sorted) {
    if (t.transferredAt > cursorStart) {
      segments.push({ bedId: cursorBed, start: cursorStart, end: t.transferredAt });
    }
    cursorStart = t.transferredAt;
    cursorBed = t.toBedId;
  }
  if (end > cursorStart) segments.push({ bedId: cursorBed, start: cursorStart, end });
  return segments;
}

/** The segment occupied at a given instant; clamps to the last segment at/after end. */
function segmentAt(segments: OccupancySegment[], instantMs: number): OccupancySegment | null {
  for (const s of segments) {
    if (instantMs >= s.start.getTime() && instantMs < s.end.getTime()) return s;
  }
  return segments.length ? segments[segments.length - 1] : null;
}

/**
 * Compute the bed-charge plan for an admission as of a given instant.
 * Idempotent: only calendar dates after the watermark are charged.
 */
export function planBedCharges(input: PlanInput): BedChargePlan {
  const { admission, transfers, wardByBedId, policy, asOf } = input;
  const final = admission.dischargedAt != null;
  const end = admission.dischargedAt ?? asOf;
  const prior = admission.bedChargedThrough ? startOfDay(admission.bedChargedThrough) : null;
  const empty: BedChargePlan = { lines: [], chargedThrough: prior, totalUnits: 0, totalAmount: 0 };

  const segments = buildOccupancySegments(admission, transfers, end);
  if (segments.length === 0 && !final) return empty;

  const admitDay = startOfDay(admission.admittedAt);
  const lastDay = startOfDay(end);
  const watermarkMs = prior ? prior.getTime() : -Infinity;

  type Charged = { date: Date; ward: WardRate };
  const charged: Charged[] = [];

  for (let day = new Date(admitDay); day.getTime() <= lastDay.getTime(); day = addDays(day, 1)) {
    const dayMs = day.getTime();
    const isAdmitDay = dayMs === admitDay.getTime();
    const isLastDay = dayMs === lastDay.getTime();
    const isSingleDay = admitDay.getTime() === lastDay.getTime();

    // Already settled by a prior accrual.
    if (dayMs <= watermarkMs) continue;
    // Admission-day policy (a same-day stay is governed by minUnits below, not skipped here).
    if (isAdmitDay && !isSingleDay && !policy.chargeAdmissionDay) continue;
    // Final discharge-day policy; interim runs never charge the in-progress current day.
    if (final) {
      if (isLastDay && !isSingleDay && !policy.chargeDischargeDay) continue;
    } else if (isLastDay) {
      continue; // today is not over yet
    }

    // Ward occupied at the last present moment of this date (midnight-census of the day).
    const endOfDayMs = dayMs + MS_PER_DAY - 1;
    const censusMs = Math.min(endOfDayMs, end.getTime() - 1);
    const seg = segmentAt(segments, Math.max(censusMs, admission.admittedAt.getTime()));
    const ward = seg ? wardByBedId.get(seg.bedId) : undefined;
    charged.push({
      date: new Date(day),
      ward: ward ?? { wardId: seg?.bedId ?? '', wardName: '(unrated bed)', dailyRate: 0, chargeCatalogId: null },
    });
  }

  // Group charged dates into one line per ward.
  const byWard = new Map<string, { ward: WardRate; units: number; from: Date; to: Date }>();
  const addUnit = (ward: WardRate, date: Date, units = 1) => {
    const key = ward.wardId || ward.wardName;
    const e = byWard.get(key);
    if (!e) byWard.set(key, { ward, units, from: date, to: date });
    else {
      e.units += units;
      if (date < e.from) e.from = date;
      if (date > e.to) e.to = date;
    }
  };
  for (const c of charged) addUnit(c.ward, c.date);

  let totalUnits = charged.length;

  // Minimum-stay floor: applied once, at the first accrual of a discharged stay.
  if (final && prior == null && totalUnits < policy.minUnits) {
    const admWard = wardByBedId.get(segments[0]?.bedId ?? admission.bedId) ?? charged[0]?.ward;
    if (admWard) {
      addUnit(admWard, admitDay, policy.minUnits - totalUnits);
      totalUnits = policy.minUnits;
    }
  }

  const lines: BedChargeLine[] = [...byWard.values()]
    .filter((e) => e.units > 0)
    .map((e) => ({
      wardId: e.ward.wardId,
      wardName: e.ward.wardName,
      catalogId: e.ward.chargeCatalogId,
      fromDate: dateKey(e.from),
      toDate: dateKey(e.to),
      units: e.units,
      unitPrice: e.ward.dailyRate,
      total: e.units * e.ward.dailyRate,
    }));
  const totalAmount = lines.reduce((sum, l) => sum + l.total, 0);

  // Advance the watermark. At discharge the stay is fully settled through the last day;
  // at interim it advances to the last completed day actually charged.
  let chargedThrough = prior;
  if (final) chargedThrough = lastDay;
  else if (charged.length) chargedThrough = charged.reduce((a, c) => (c.date > a ? c.date : a), charged[0].date);

  return { lines, chargedThrough, totalUnits, totalAmount };
}
