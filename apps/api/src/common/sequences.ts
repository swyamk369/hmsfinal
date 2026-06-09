import type { TenantClient } from '@hms/db';

/** Reads tenant document prefixes, with safe defaults. */
async function prefixes(db: TenantClient, tenantId: string): Promise<{ mrn: string; invoice: string }> {
  const s = await db.hospitalSettings.findUnique({ where: { tenantId } });
  return { mrn: s?.mrnPrefix || 'MRN', invoice: s?.invoicePrefix || 'INV' };
}

const pad = (n: number) => String(n).padStart(5, '0');

/** Generates the next MRN (`PREFIX-YYYY-00001`), retrying on collision. */
export async function nextMrn(db: TenantClient, tenantId: string): Promise<string> {
  const { mrn } = await prefixes(db, tenantId);
  const year = new Date().getFullYear();
  const base = await db.patient.count();
  for (let i = 0; i < 8; i++) {
    const candidate = `${mrn}-${year}-${pad(base + 1 + i)}`;
    const exists = await db.patient.findFirst({ where: { mrn: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${mrn}-${year}-${Date.now().toString(36).toUpperCase()}`;
}

/** Generates the next bill number (`PREFIX-YYYY-00001`), retrying on collision. */
export async function nextBillNumber(db: TenantClient, tenantId: string): Promise<string> {
  const { invoice } = await prefixes(db, tenantId);
  const year = new Date().getFullYear();
  const base = await db.bill.count();
  for (let i = 0; i < 8; i++) {
    const candidate = `${invoice}-${year}-${pad(base + 1 + i)}`;
    const exists = await db.bill.findFirst({ where: { billNumber: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${invoice}-${year}-${Date.now().toString(36).toUpperCase()}`;
}

/** Next OPD token number for today (per tenant). */
export async function nextToken(db: TenantClient): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const todays = await db.encounter.count({ where: { createdAt: { gte: start } } });
  return todays + 1;
}
