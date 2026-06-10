/**
 * Phase 16 — Audit, Compliance, And Safety.
 *
 * Hermetic proofs: reason fields reject blank/whitespace at DTO level, the
 * global error shape leaks nothing, request logs exclude query strings, the
 * tenant audit search builds correct filters, lab-order cancellation requires
 * a reason, and the SQL hardening (append-only audit, REVOKE) is present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CancelBillDto } from '../src/billing/dto';
import { TransferDto } from '../src/ipd/dto';
import { AdjustStockDto } from '../src/inventory/dto';
import { toErrorBody } from '../src/common/http-exception.filter';
import { formatRequestLog, pathOnly } from '../src/common/request-logger.middleware';
import { AdminService } from '../src/admin/admin.service';
import { LabService } from '../src/lab/lab.service';
import { AuditService } from '../src/common/audit.service';
import { emptyContext, type RequestContext } from '../src/common/types';

const asAudit = (a: any) => a as unknown as AuditService;

function mockAudit() {
  return { log: jest.fn().mockResolvedValue(undefined), platformLog: jest.fn() };
}

function model() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'new' }),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    count: jest.fn().mockResolvedValue(0),
  };
}

function ctx(db: Record<string, any>): RequestContext {
  return { ...emptyContext(), userId: 'admin1', tenantId: 't1', db: db as any };
}

// ── Reason enforcement (DTO level) ───────────────────────────────
describe('Phase 16 reason enforcement', () => {
  const cases: Array<[string, any]> = [
    ['billing cancel', CancelBillDto],
    ['ipd transfer', TransferDto],
    ['inventory adjust', AdjustStockDto],
  ];

  it.each(cases)('%s rejects a missing reason', async (_name, cls) => {
    const errors = await validate(plainToInstance(cls, {}), { skipMissingProperties: false });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it.each(cases)('%s rejects a whitespace-only reason', async (_name, cls) => {
    const errors = await validate(plainToInstance(cls, { reason: '   ' }));
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('trims and accepts a real reason', async () => {
    const dto = plainToInstance(CancelBillDto, { reason: '  duplicate entry  ' });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'reason')).toHaveLength(0);
    expect(dto.reason).toBe('duplicate entry');
  });
});

// ── Global error shape ───────────────────────────────────────────
describe('Phase 16 error handling', () => {
  it('keeps status and message for known HttpExceptions', () => {
    const body = toErrorBody(new NotFoundException('Patient not found'));
    expect(body).toMatchObject({ statusCode: 404, message: 'Patient not found' });
  });

  it('keeps validation message arrays explicit', () => {
    const ex = new HttpException({ statusCode: 400, error: 'Bad Request', message: ['reason is required'] }, 400);
    expect(toErrorBody(ex).message).toEqual(['reason is required']);
  });

  it('maps unknown errors to a generic 500 with no internals', () => {
    const body = toErrorBody(new Error('ECONNREFUSED postgres://user:secret@db:5432'));
    expect(body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});

// ── Structured logs redaction ────────────────────────────────────
describe('Phase 16 request logging', () => {
  it('strips the query string from logged paths', () => {
    expect(pathOnly('/patients?q=Asha+Sharma&phone=9999')).toBe('/patients');
    expect(pathOnly('/billing/bills')).toBe('/billing/bills');
  });

  it('log line contains only whitelisted fields', () => {
    const line = formatRequestLog({
      requestId: 'r1',
      method: 'GET',
      path: '/patients',
      status: 200,
      durationMs: 12,
      userId: 'u1',
      tenantId: 't1',
    });
    expect(JSON.parse(line)).toEqual({
      requestId: 'r1',
      method: 'GET',
      path: '/patients',
      status: 200,
      durationMs: 12,
      userId: 'u1',
      tenantId: 't1',
    });
    expect(line).not.toContain('authorization');
  });
});

// ── Tenant audit search ──────────────────────────────────────────
describe('Phase 16 audit search', () => {
  let db: Record<string, any>;
  let svc: AdminService;

  beforeEach(() => {
    db = { auditLog: model(), user: model() };
    svc = new AdminService(asAudit(mockAudit()));
  });

  it('builds filters and pagination from the query', async () => {
    db.auditLog.count.mockResolvedValue(120);
    db.auditLog.findMany.mockResolvedValue([]);
    const res = await svc.searchAudit(ctx(db), {
      action: 'bill.cancel',
      entity: 'bill',
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-10T00:00:00.000Z',
      page: 2,
      pageSize: 25,
    });
    const args = db.auditLog.findMany.mock.calls[0][0];
    expect(args.where.action).toEqual({ contains: 'bill.cancel', mode: 'insensitive' });
    expect(args.where.entity).toEqual({ contains: 'bill', mode: 'insensitive' });
    expect(args.where.createdAt.gte).toEqual(new Date('2026-06-01T00:00:00.000Z'));
    expect(args.skip).toBe(25);
    expect(args.take).toBe(25);
    expect(res).toMatchObject({ total: 120, page: 2, pageSize: 25, rows: [] });
  });

  it('returns whitelisted fields and resolves actor names', async () => {
    db.auditLog.count.mockResolvedValue(1);
    db.auditLog.findMany.mockResolvedValue([
      { id: 'a1', action: 'patient.archive', entity: 'patient', entityId: 'p1', actorId: 'u1', metadata: { reason: 'duplicate' }, createdAt: new Date() },
    ]);
    db.user.findMany.mockResolvedValue([{ id: 'u1', fullName: 'Admin One', email: 'admin@demo.local' }]);
    const res = await svc.searchAudit(ctx(db), {});
    expect(res.rows[0].actor).toEqual({ id: 'u1', fullName: 'Admin One', email: 'admin@demo.local' });
    // select whitelist was passed to prisma
    const select = db.auditLog.findMany.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual(
      ['action', 'actorId', 'createdAt', 'entity', 'entityId', 'id', 'metadata'].sort(),
    );
  });
});

// ── Lab cancellation requires reason ─────────────────────────────
describe('Phase 16 lab cancel reason', () => {
  it('rejects CANCELLED without a reason and never mutates', async () => {
    const db: Record<string, any> = { labOrder: model(), labOrderItem: model() };
    db.labOrder.findFirst.mockResolvedValue({ id: 'lo1', status: 'ORDERED', items: [] });
    const svc = new LabService(asAudit(mockAudit()));
    await expect(
      svc.updateStatus(ctx(db), 'lo1', { status: 'CANCELLED', reason: '  ' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.labOrder.update).not.toHaveBeenCalled();
  });
});

// ── SQL + wiring hardening proofs (static) ───────────────────────
describe('Phase 16 hardening artifacts', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), 'utf8');

  it('rls.sql keeps both audit tables append-only and revokes UPDATE/DELETE', () => {
    const sql = read('../../../packages/db/sql/rls.sql');
    expect(sql).toContain('CREATE TRIGGER audit_log_immutable');
    expect(sql).toContain('CREATE TRIGGER platform_audit_log_immutable');
    expect(sql).toContain('REVOKE UPDATE, DELETE ON public.audit_log FROM hms_app');
    expect(sql).toContain('REVOKE UPDATE, DELETE ON public.platform_audit_log FROM hms_app');
  });

  it('app wiring registers rate limiting, logging, and the exception filter', () => {
    const appModule = read('../src/app.module.ts');
    const main = read('../src/main.ts');
    // ThrottlerGuard must come before AuthGuard in the guard chain.
    expect(appModule.indexOf('ThrottlerGuard')).toBeGreaterThan(-1);
    expect(appModule.indexOf('useClass: ThrottlerGuard')).toBeLessThan(appModule.indexOf('useClass: AuthGuard'));
    expect(appModule).toContain('RequestLoggerMiddleware');
    expect(main).toContain('GlobalHttpExceptionFilter');
    expect(main).toContain('helmet()');
  });
});
