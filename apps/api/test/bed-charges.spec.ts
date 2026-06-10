import {
  bedChargePolicyFromSettings,
  buildOccupancySegments,
  planBedCharges,
  type BedChargePolicy,
  type WardRate,
} from '../src/ipd/bed-charges';

// Local-time date helper (month is 1-based here for readability).
const dt = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

const ICU: WardRate = { wardId: 'w-icu', wardName: 'ICU', dailyRate: 500000, chargeCatalogId: null };
const PRIVATE: WardRate = { wardId: 'w-priv', wardName: 'Private', dailyRate: 300000, chargeCatalogId: null };
const GENERAL: WardRate = { wardId: 'w-gen', wardName: 'General', dailyRate: 100000, chargeCatalogId: null };

const policy = (over: Partial<BedChargePolicy> = {}): BedChargePolicy => ({
  dayBasis: 'CALENDAR_DAY',
  chargeAdmissionDay: true,
  chargeDischargeDay: true,
  minUnits: 1,
  ...over,
});

describe('bedChargePolicyFromSettings', () => {
  it('applies safe defaults', () => {
    expect(bedChargePolicyFromSettings(undefined)).toEqual({
      dayBasis: 'CALENDAR_DAY',
      chargeAdmissionDay: true,
      chargeDischargeDay: false,
      minUnits: 1,
    });
  });
  it('reads stored settings', () => {
    expect(
      bedChargePolicyFromSettings({ ipdDayBasis: 'CALENDAR_DAY', ipdChargeAdmissionDay: true, ipdChargeDischargeDay: true, ipdMinUnits: 2 }),
    ).toEqual({ dayBasis: 'CALENDAR_DAY', chargeAdmissionDay: true, chargeDischargeDay: true, minUnits: 2 });
  });
});

describe('buildOccupancySegments', () => {
  it('single bed, no transfers → one segment', () => {
    const segs = buildOccupancySegments(
      { bedId: 'bed1', admittedAt: dt(2026, 6, 1, 14), dischargedAt: null, bedChargedThrough: null },
      [],
      dt(2026, 6, 3, 10),
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].bedId).toBe('bed1');
  });

  it('rebuilds the bed timeline across transfers', () => {
    const segs = buildOccupancySegments(
      { bedId: 'bedP', admittedAt: dt(2026, 6, 1, 14), dischargedAt: null, bedChargedThrough: null },
      [{ fromBedId: 'bedI', toBedId: 'bedP', transferredAt: dt(2026, 6, 2, 12) }],
      dt(2026, 6, 4, 10),
    );
    expect(segs.map((s) => s.bedId)).toEqual(['bedI', 'bedP']);
    expect(segs[0].end).toEqual(dt(2026, 6, 2, 12));
    expect(segs[1].start).toEqual(dt(2026, 6, 2, 12));
  });
});

describe('planBedCharges — calendar-day per-diem', () => {
  const wardMap = (entries: [string, WardRate][]) => new Map(entries);

  it('charges every calendar day when admission and discharge days both count', () => {
    const plan = planBedCharges({
      admission: { bedId: 'bed1', admittedAt: dt(2026, 6, 1, 14), dischargedAt: dt(2026, 6, 3, 10), bedChargedThrough: null },
      transfers: [],
      wardByBedId: wardMap([['bed1', GENERAL]]),
      policy: policy({ chargeDischargeDay: true }),
      asOf: dt(2026, 6, 3, 10),
    });
    expect(plan.totalUnits).toBe(3); // Jun 1, 2, 3
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0]).toMatchObject({ wardId: 'w-gen', units: 3, unitPrice: 100000, total: 300000 });
  });

  it('excludes the discharge day when policy says so', () => {
    const plan = planBedCharges({
      admission: { bedId: 'bed1', admittedAt: dt(2026, 6, 1, 14), dischargedAt: dt(2026, 6, 3, 10), bedChargedThrough: null },
      transfers: [],
      wardByBedId: wardMap([['bed1', GENERAL]]),
      policy: policy({ chargeDischargeDay: false }),
      asOf: dt(2026, 6, 3, 10),
    });
    expect(plan.totalUnits).toBe(2); // Jun 1, 2
    expect(plan.lines[0].total).toBe(200000);
  });

  it('splits a stay across wards by each ward rate on a transfer', () => {
    const plan = planBedCharges({
      admission: { bedId: 'bedP', admittedAt: dt(2026, 6, 1, 14), dischargedAt: dt(2026, 6, 4, 10), bedChargedThrough: null },
      transfers: [{ fromBedId: 'bedI', toBedId: 'bedP', transferredAt: dt(2026, 6, 2, 12) }],
      wardByBedId: wardMap([
        ['bedI', ICU],
        ['bedP', PRIVATE],
      ]),
      policy: policy({ chargeDischargeDay: true }),
      asOf: dt(2026, 6, 4, 10),
    });
    // Jun 1 in ICU; Jun 2 (post-noon transfer), Jun 3, Jun 4 in Private.
    const icu = plan.lines.find((l) => l.wardId === 'w-icu')!;
    const priv = plan.lines.find((l) => l.wardId === 'w-priv')!;
    expect(icu.units).toBe(1);
    expect(priv.units).toBe(3);
    expect(plan.totalAmount).toBe(500000 + 3 * 300000);
  });

  it('is idempotent — a prior watermark is not re-charged', () => {
    const plan = planBedCharges({
      admission: { bedId: 'bed1', admittedAt: dt(2026, 6, 1, 14), dischargedAt: dt(2026, 6, 3, 10), bedChargedThrough: dt(2026, 6, 2) },
      transfers: [],
      wardByBedId: wardMap([['bed1', GENERAL]]),
      policy: policy({ chargeDischargeDay: true }),
      asOf: dt(2026, 6, 3, 10),
    });
    expect(plan.totalUnits).toBe(1); // only Jun 3 remains after the Jun 2 watermark
    expect(plan.lines[0].total).toBe(100000);
  });

  it('bills the minimum for a same-day admission/discharge', () => {
    const plan = planBedCharges({
      admission: { bedId: 'bed1', admittedAt: dt(2026, 6, 1, 9), dischargedAt: dt(2026, 6, 1, 14), bedChargedThrough: null },
      transfers: [],
      wardByBedId: wardMap([['bed1', GENERAL]]),
      policy: policy({ chargeAdmissionDay: false, minUnits: 1 }),
      asOf: dt(2026, 6, 1, 14),
    });
    expect(plan.totalUnits).toBe(1);
    expect(plan.lines[0].total).toBe(100000);
  });

  it('interim accrual charges only completed days and advances the watermark', () => {
    const plan = planBedCharges({
      admission: { bedId: 'bed1', admittedAt: dt(2026, 6, 1, 14), dischargedAt: null, bedChargedThrough: null },
      transfers: [],
      wardByBedId: wardMap([['bed1', GENERAL]]),
      policy: policy(),
      asOf: dt(2026, 6, 3, 10), // "now" — Jun 3 is in progress
    });
    expect(plan.totalUnits).toBe(2); // Jun 1, Jun 2 (today excluded)
    expect(plan.chargedThrough).toEqual(dt(2026, 6, 2));
  });

  it('discharge after an interim run settles only the remaining days', () => {
    const plan = planBedCharges({
      admission: { bedId: 'bed1', admittedAt: dt(2026, 6, 1, 14), dischargedAt: dt(2026, 6, 4, 10), bedChargedThrough: dt(2026, 6, 2) },
      transfers: [],
      wardByBedId: wardMap([['bed1', GENERAL]]),
      policy: policy({ chargeDischargeDay: true }),
      asOf: dt(2026, 6, 4, 10),
    });
    expect(plan.totalUnits).toBe(2); // Jun 3, Jun 4
    expect(plan.chargedThrough).toEqual(dt(2026, 6, 4));
  });
});
