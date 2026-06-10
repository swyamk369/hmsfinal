import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { tenantTransaction } from '@hms/db';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ApproveClaimDto,
  CancelClaimDto,
  ClaimNotesDto,
  ClaimReviewDto,
  CreateClaimDto,
  CreatePolicyDto,
  RejectClaimDto,
  SettleClaimDto,
  UpdatePolicyDto,
} from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

interface CoverageDetails {
  memberId?: string;
  planName?: string;
  coverageType?: string;
  validFrom?: string;
  validTo?: string;
  coverageLimit?: number;
  patientSharePercent?: number;
  notes?: string;
}

const PATIENT_SELECT = { select: { id: true, fullName: true, mrn: true, phone: true } };
const CLOSED_CLAIMS = ['REJECTED', 'CANCELLED'] as const;
const SETTLEABLE_CLAIMS = ['APPROVED', 'PARTIALLY_APPROVED'] as const;

@Injectable()
export class InsuranceService {
  constructor(private readonly audit: AuditService, private readonly notifications?: NotificationsService) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private record(s: Scope, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log(s.db, { tenantId: s.tenantId, actorId: s.actorId, action, entity, entityId, metadata });
  }

  private parseCoverage(raw?: string | null): CoverageDetails {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return { notes: raw };
    }
  }

  private coverageFromDto(dto: Partial<CreatePolicyDto & UpdatePolicyDto>, previous?: string | null): string | undefined {
    const next: CoverageDetails = { ...this.parseCoverage(previous) };
    for (const key of [
      'memberId',
      'planName',
      'coverageType',
      'validFrom',
      'validTo',
      'coverageLimit',
      'patientSharePercent',
      'notes',
    ] as const) {
      if (dto[key] !== undefined) (next as any)[key] = dto[key] === '' ? undefined : dto[key];
    }
    return JSON.stringify(next);
  }

  private decoratePolicy<T extends { coverageDetails?: string | null }>(policy: T): T & { coverage: CoverageDetails } {
    return { ...policy, coverage: this.parseCoverage(policy.coverageDetails) };
  }

  private decorateClaim<T extends { patientPolicy?: { coverageDetails?: string | null } | null }>(claim: T): T {
    if (!claim.patientPolicy) return claim;
    return {
      ...claim,
      patientPolicy: this.decoratePolicy(claim.patientPolicy),
    };
  }

  private totals(payments: { amount: number }[] = [], refunds: { amount: number }[] = []) {
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    const refunded = refunds.reduce((s, r) => s + r.amount, 0);
    return { paid, refunded };
  }

  private billStatus(net: number, paid: number, refunded: number, cancelled = false): any {
    if (cancelled) return 'CANCELLED';
    const netPaid = paid - refunded;
    if (paid === 0) return 'UNPAID';
    if (netPaid <= 0) return 'REFUNDED';
    if (netPaid >= net) return 'PAID';
    return 'PARTIAL';
  }

  providers(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.insuranceProvider.findMany({ orderBy: { name: 'asc' } });
  }

  async listPolicies(ctx: RequestContext, filters: { patientId?: string; q?: string }) {
    const { db } = this.scope(ctx);
    const where: any = {};
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.q) {
      where.OR = [
        { policyNumber: { contains: filters.q, mode: 'insensitive' } },
        { patient: { fullName: { contains: filters.q, mode: 'insensitive' } } },
        { patient: { mrn: { contains: filters.q, mode: 'insensitive' } } },
      ];
    }
    const rows = await db.patientInsurancePolicy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { patient: PATIENT_SELECT, provider: true, _count: { select: { claims: true } } },
    });
    return rows.map((p) => this.decoratePolicy(p));
  }

  async createPolicy(ctx: RequestContext, dto: CreatePolicyDto) {
    const s = this.scope(ctx);
    const [patient, provider, duplicate] = await Promise.all([
      s.db.patient.findFirst({ where: { id: dto.patientId, deletedAt: null }, select: { id: true } }),
      s.db.insuranceProvider.findFirst({ where: { id: dto.providerId, active: true }, select: { id: true, name: true } }),
      s.db.patientInsurancePolicy.findFirst({
        where: { providerId: dto.providerId, policyNumber: dto.policyNumber, active: true },
        select: { id: true },
      }),
    ]);
    if (!patient) throw new BadRequestException('Patient not found');
    if (!provider) throw new BadRequestException('Insurance provider not found or inactive');
    if (duplicate) throw new BadRequestException('An active policy with this provider and policy number already exists');

    const policy = await s.db.patientInsurancePolicy.create({
      data: {
        tenantId: s.tenantId,
        patientId: dto.patientId,
        providerId: dto.providerId,
        policyNumber: dto.policyNumber,
        coverageDetails: this.coverageFromDto(dto),
      },
      include: { patient: PATIENT_SELECT, provider: true, _count: { select: { claims: true } } },
    });
    await this.record(s, 'insurance.policy.create', 'patient_insurance_policy', policy.id, {
      patientId: dto.patientId,
      providerId: dto.providerId,
      policyNumber: dto.policyNumber,
    });
    return this.decoratePolicy(policy);
  }

  async updatePolicy(ctx: RequestContext, id: string, dto: UpdatePolicyDto) {
    const s = this.scope(ctx);
    const existing = await s.db.patientInsurancePolicy.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Policy not found');
    if (dto.providerId) {
      const provider = await s.db.insuranceProvider.findFirst({ where: { id: dto.providerId, active: true }, select: { id: true } });
      if (!provider) throw new BadRequestException('Insurance provider not found or inactive');
    }
    const policy = await s.db.patientInsurancePolicy.update({
      where: { id },
      data: {
        providerId: dto.providerId,
        policyNumber: dto.policyNumber,
        active: dto.active,
        coverageDetails: this.coverageFromDto(dto, existing.coverageDetails),
      },
      include: { patient: PATIENT_SELECT, provider: true, _count: { select: { claims: true } } },
    });
    await this.record(
      s,
      dto.active === false ? 'insurance.policy.deactivate' : 'insurance.policy.update',
      'patient_insurance_policy',
      id,
      { changes: dto },
    );
    return this.decoratePolicy(policy);
  }

  async eligibleBills(ctx: RequestContext, filters: { patientId?: string; q?: string }) {
    const { db } = this.scope(ctx);
    const where: any = { status: { not: 'CANCELLED' } };
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.q) {
      where.OR = [
        { billNumber: { contains: filters.q, mode: 'insensitive' } },
        { patient: { fullName: { contains: filters.q, mode: 'insensitive' } } },
        { patient: { mrn: { contains: filters.q, mode: 'insensitive' } } },
      ];
    }
    return db.bill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        patient: PATIENT_SELECT,
        payments: true,
        refunds: true,
        claims: { include: { patientPolicy: { include: { provider: true } }, settlements: true } },
      },
    });
  }

  async listClaims(ctx: RequestContext, filters: { status?: string; q?: string }) {
    const { db } = this.scope(ctx);
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.q) {
      where.OR = [
        { bill: { billNumber: { contains: filters.q, mode: 'insensitive' } } },
        { bill: { patient: { fullName: { contains: filters.q, mode: 'insensitive' } } } },
        { bill: { patient: { mrn: { contains: filters.q, mode: 'insensitive' } } } },
        { patientPolicy: { policyNumber: { contains: filters.q, mode: 'insensitive' } } },
      ];
    }
    const rows = await db.insuranceClaim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        bill: { include: { patient: PATIENT_SELECT, payments: true, refunds: true } },
        patientPolicy: { include: { provider: true, patient: PATIENT_SELECT } },
        settlements: { orderBy: { settledAt: 'desc' } },
      },
    });
    return rows.map((c) => this.decorateClaim(c));
  }

  async getClaim(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const claim = await s.db.insuranceClaim.findFirst({
      where: { id },
      include: {
        bill: { include: { patient: PATIENT_SELECT, items: true, payments: true, refunds: true } },
        patientPolicy: { include: { provider: true, patient: PATIENT_SELECT } },
        settlements: { orderBy: { settledAt: 'desc' } },
      },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    return this.decorateClaim(claim);
  }

  private calculateClaim(bill: { netAmount: number }, policy: { coverageDetails?: string | null }, dto: CreateClaimDto) {
    const coverage = this.parseCoverage(policy.coverageDetails);
    const patientShare =
      dto.patientShare ?? Math.round((bill.netAmount * Math.max(0, Math.min(100, coverage.patientSharePercent ?? 0))) / 100);
    const defaultClaimable = Math.max(0, bill.netAmount - patientShare);
    const limited = coverage.coverageLimit && coverage.coverageLimit > 0 ? Math.min(defaultClaimable, coverage.coverageLimit) : defaultClaimable;
    const claimAmount = dto.claimAmount ?? limited;
    if (claimAmount <= 0) throw new BadRequestException('Claim amount must be greater than zero');
    if (claimAmount + patientShare > bill.netAmount) {
      throw new BadRequestException('Claim amount plus patient share cannot exceed bill net amount');
    }
    return { claimAmount, patientShare };
  }

  async createClaim(ctx: RequestContext, dto: CreateClaimDto) {
    const s = this.scope(ctx);
    const bill = await s.db.bill.findFirst({
      where: { id: dto.billId },
      include: { patient: PATIENT_SELECT, claims: true },
    });
    if (!bill) throw new BadRequestException('Bill not found');
    if (bill.status === 'CANCELLED') throw new BadRequestException('Cannot create a claim from a cancelled bill');

    const policy = await s.db.patientInsurancePolicy.findFirst({
      where: { id: dto.patientPolicyId, active: true },
      include: { provider: true },
    });
    if (!policy) throw new BadRequestException('Active patient policy not found');
    if (policy.patientId !== bill.patientId) throw new BadRequestException('Policy does not belong to the billed patient');

    const duplicate = bill.claims.find(
      (c) => c.patientPolicyId === dto.patientPolicyId && !CLOSED_CLAIMS.includes(c.status as any),
    );
    if (duplicate) throw new BadRequestException('This bill already has an active claim for that policy');

    const amounts = this.calculateClaim(bill, policy, dto);
    const status = dto.submit ? 'SUBMITTED' : 'DRAFT';
    const claim = await s.db.insuranceClaim.create({
      data: {
        tenantId: s.tenantId,
        billId: bill.id,
        patientPolicyId: policy.id,
        providerId: policy.providerId,
        claimAmount: amounts.claimAmount,
        patientShare: amounts.patientShare,
        status: status as any,
        submittedAt: dto.submit ? new Date() : null,
        notes: dto.notes,
      },
    });
    await this.record(s, 'insurance.claim.create', 'insurance_claim', claim.id, {
      billId: bill.id,
      patientPolicyId: policy.id,
      claimAmount: amounts.claimAmount,
      status,
    });
    if (status === 'SUBMITTED') {
      await this.notifications?.safeNotify(ctx, {
        category: 'INSURANCE',
        type: 'insurance.claim.submitted',
        severity: 'INFO',
        title: 'Insurance claim submitted',
        message: 'An insurance claim has been submitted for review.',
        actionUrl: `/insurance/claims/${claim.id}`,
        metadata: { claimId: claim.id, billId: bill.id, claimAmount: amounts.claimAmount },
        roleCodes: ['INSURANCE_STAFF', 'BILLING', 'HOSPITAL_ADMIN'],
      });
    }
    return this.getClaim(ctx, claim.id);
  }

  async updateNotes(ctx: RequestContext, id: string, dto: ClaimNotesDto) {
    const s = this.scope(ctx);
    const existing = await s.db.insuranceClaim.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Claim not found');
    if (existing.status === 'SETTLED') throw new BadRequestException('Cannot edit a settled claim');
    await s.db.insuranceClaim.update({ where: { id }, data: { notes: dto.notes } });
    await this.record(s, 'insurance.claim.update', 'insurance_claim', id, { notes: dto.notes });
    return this.getClaim(ctx, id);
  }

  async submit(ctx: RequestContext, id: string, dto: ClaimReviewDto) {
    const s = this.scope(ctx);
    const existing = await s.db.insuranceClaim.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Claim not found');
    if (existing.status !== 'DRAFT') throw new BadRequestException('Only draft claims can be submitted');
    await s.db.insuranceClaim.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date(), notes: dto.notes ?? existing.notes } });
    await this.record(s, 'insurance.claim.submit', 'insurance_claim', id, { notes: dto.notes });
    await this.notifications?.safeNotify(ctx, {
      category: 'INSURANCE',
      type: 'insurance.claim.submitted',
      severity: 'INFO',
      title: 'Insurance claim submitted',
      message: 'An insurance claim has been submitted for review.',
      actionUrl: `/insurance/claims/${id}`,
      metadata: { claimId: id },
      roleCodes: ['INSURANCE_STAFF', 'BILLING', 'HOSPITAL_ADMIN'],
    });
    return this.getClaim(ctx, id);
  }

  async markUnderReview(ctx: RequestContext, id: string, dto: ClaimReviewDto) {
    const s = this.scope(ctx);
    const existing = await s.db.insuranceClaim.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Claim not found');
    if (existing.status !== 'SUBMITTED') throw new BadRequestException('Only submitted claims can move under review');
    await s.db.insuranceClaim.update({ where: { id }, data: { status: 'UNDER_REVIEW', notes: dto.notes ?? existing.notes } });
    await this.record(s, 'insurance.claim.review', 'insurance_claim', id, { notes: dto.notes });
    return this.getClaim(ctx, id);
  }

  async approve(ctx: RequestContext, id: string, dto: ApproveClaimDto) {
    const s = this.scope(ctx);
    const existing = await s.db.insuranceClaim.findFirst({ where: { id }, include: { bill: true } });
    if (!existing) throw new NotFoundException('Claim not found');
    if (!['SUBMITTED', 'UNDER_REVIEW', 'PARTIALLY_APPROVED'].includes(existing.status)) {
      throw new BadRequestException(`Cannot approve a ${existing.status.toLowerCase().replace(/_/g, ' ')} claim`);
    }
    const approvedAmount = dto.approvedAmount ?? existing.claimAmount;
    if (approvedAmount > existing.claimAmount) throw new BadRequestException('Approved amount cannot exceed claim amount');
    const patientShare = dto.patientShare ?? Math.max(0, existing.bill.netAmount - approvedAmount);
    if (approvedAmount + patientShare > existing.bill.netAmount) {
      throw new BadRequestException('Approved amount plus patient share cannot exceed bill net amount');
    }
    const status = approvedAmount < existing.claimAmount ? 'PARTIALLY_APPROVED' : 'APPROVED';
    await s.db.insuranceClaim.update({
      where: { id },
      data: { status: status as any, approvedAmount, patientShare, approvedAt: new Date(), notes: dto.notes ?? existing.notes },
    });
    await this.record(s, 'insurance.claim.approve', 'insurance_claim', id, { approvedAmount, patientShare, status });
    await this.notifications?.safeNotify(ctx, {
      category: 'INSURANCE',
      type: 'insurance.claim.approved',
      severity: 'SUCCESS',
      title: 'Insurance claim approved',
      message: 'An insurance claim has been approved and is ready for settlement tracking.',
      actionUrl: `/insurance/claims/${id}`,
      metadata: { claimId: id, approvedAmount, patientShare, status },
      roleCodes: ['INSURANCE_STAFF', 'BILLING', 'ACCOUNTANT', 'HOSPITAL_ADMIN'],
    });
    return this.getClaim(ctx, id);
  }

  async reject(ctx: RequestContext, id: string, dto: RejectClaimDto) {
    const s = this.scope(ctx);
    const existing = await s.db.insuranceClaim.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Claim not found');
    if (existing.status === 'SETTLED') throw new BadRequestException('Cannot reject a settled claim');
    await s.db.insuranceClaim.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: dto.reason } });
    await this.record(s, 'insurance.claim.reject', 'insurance_claim', id, { reason: dto.reason });
    await this.notifications?.safeNotify(ctx, {
      category: 'INSURANCE',
      type: 'insurance.claim.rejected',
      severity: 'WARNING',
      title: 'Insurance claim rejected',
      message: 'An insurance claim was rejected and needs follow-up.',
      actionUrl: `/insurance/claims/${id}`,
      metadata: { claimId: id },
      roleCodes: ['INSURANCE_STAFF', 'BILLING', 'HOSPITAL_ADMIN'],
    });
    return this.getClaim(ctx, id);
  }

  async cancel(ctx: RequestContext, id: string, dto: CancelClaimDto) {
    const s = this.scope(ctx);
    const existing = await s.db.insuranceClaim.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Claim not found');
    if (existing.status === 'SETTLED') throw new BadRequestException('Cannot cancel a settled claim');
    await s.db.insuranceClaim.update({ where: { id }, data: { status: 'CANCELLED', rejectionReason: dto.reason } });
    await this.record(s, 'insurance.claim.cancel', 'insurance_claim', id, { reason: dto.reason });
    return this.getClaim(ctx, id);
  }

  async settle(ctx: RequestContext, id: string, dto: SettleClaimDto) {
    const s = this.scope(ctx);
    const existing = await s.db.insuranceClaim.findFirst({
      where: { id },
      include: { bill: { include: { payments: true, refunds: true } }, settlements: true },
    });
    if (!existing) throw new NotFoundException('Claim not found');
    if (!SETTLEABLE_CLAIMS.includes(existing.status as any)) {
      throw new BadRequestException('Only approved claims can be settled');
    }
    if (existing.settlements.length > 0 || existing.status === 'SETTLED') throw new BadRequestException('Claim is already settled');
    const approved = existing.approvedAmount ?? existing.claimAmount;
    const amount = dto.amount ?? approved;
    if (amount <= 0) throw new BadRequestException('Settlement amount must be greater than zero');
    if (amount > approved) throw new BadRequestException('Settlement cannot exceed approved amount');

    await tenantTransaction(s.tenantId, async (tx) => {
      const fresh = await tx.insuranceClaim.findFirst({
        where: { id },
        include: { bill: { include: { payments: true, refunds: true } }, settlements: true },
      });
      if (!fresh) throw new NotFoundException('Claim not found');
      if (fresh.settlements.length > 0 || fresh.status === 'SETTLED') throw new BadRequestException('Claim is already settled');
      if (!SETTLEABLE_CLAIMS.includes(fresh.status as any)) throw new BadRequestException('Only approved claims can be settled');
      const payment = await tx.payment.create({
        data: {
          tenantId: s.tenantId,
          billId: fresh.billId,
          amount,
          method: 'INSURANCE',
          transactionId: dto.transactionId,
          collectedById: s.actorId,
          notes: dto.notes,
        },
      });
      await tx.claimSettlement.create({
        data: {
          tenantId: s.tenantId,
          claimId: id,
          paymentId: payment.id,
          amount,
          settledById: s.actorId,
          notes: dto.notes,
        },
      });
      const { paid, refunded } = this.totals(fresh.bill.payments, fresh.bill.refunds);
      await tx.bill.update({
        where: { id: fresh.billId },
        data: { status: this.billStatus(fresh.bill.netAmount, paid + amount, refunded, false) },
      });
      await tx.insuranceClaim.update({
        where: { id },
        data: { status: 'SETTLED', settledAt: new Date(), settlementNotes: dto.notes },
      });
    });

    await this.record(s, 'insurance.claim.settle', 'insurance_claim', id, { amount, transactionId: dto.transactionId });
    await this.notifications?.safeNotify(ctx, {
      category: 'INSURANCE',
      type: 'insurance.claim.settled',
      severity: 'SUCCESS',
      title: 'Insurance claim settled',
      message: 'An insurance claim settlement has been posted to billing.',
      actionUrl: `/insurance/claims/${id}`,
      metadata: { claimId: id, amount },
      roleCodes: ['INSURANCE_STAFF', 'ACCOUNTANT', 'BILLING', 'HOSPITAL_ADMIN'],
    });
    return this.getClaim(ctx, id);
  }

  async receivables(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const claims = await db.insuranceClaim.findMany({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'SETTLED'] as any } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        bill: { include: { patient: PATIENT_SELECT } },
        patientPolicy: { include: { provider: true, patient: PATIENT_SELECT } },
        settlements: true,
      },
    });
    const submitted = claims.filter((c) => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW');
    const approved = claims.filter((c) => c.status === 'APPROVED' || c.status === 'PARTIALLY_APPROVED');
    const settledToday = claims
      .flatMap((c) => c.settlements)
      .filter((s) => new Date(s.settledAt) >= start)
      .reduce((sum, s) => sum + s.amount, 0);
    const approvedOutstanding = approved.reduce((sum, c) => {
      const settled = c.settlements.reduce((s, row) => s + row.amount, 0);
      return sum + Math.max(0, (c.approvedAmount ?? c.claimAmount) - settled);
    }, 0);
    return {
      stats: {
        openClaims: submitted.length + approved.length,
        submittedAmount: submitted.reduce((sum, c) => sum + c.claimAmount, 0),
        approvedOutstanding,
        settledToday,
        patientShare: claims.reduce((sum, c) => sum + (c.patientShare ?? 0), 0),
      },
      claims: claims.map((c) => this.decorateClaim(c)),
    };
  }
}
