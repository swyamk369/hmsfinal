import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MODULES, PERMISSIONS } from '@hms/db';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { FinanceService } from './finance.service';
import {
  ApprovalDecisionDto,
  BillFromChargesDto,
  CancelChargeDto,
  CreateChargeDto,
  DayCloseDto,
  FinanceCancelBillDto,
  FinancePaymentDto,
  FinanceRefundDto,
  RequestApprovalDto,
} from './dto';

const FINANCE_VIEW = [
  PERMISSIONS.FINANCE_READ,
  PERMISSIONS.BILL_READ,
  PERMISSIONS.PAYMENT_COLLECT,
  PERMISSIONS.REPORTS_FINANCIAL_READ,
];

@Controller('finance')
@RequireModule(MODULES.BILLING)
export class FinanceController {
  constructor(private readonly svc: FinanceService) {}

  @Get('dashboard')
  @RequirePermission(...FINANCE_VIEW)
  dashboard(@Ctx() ctx: RequestContext) {
    return this.svc.dashboard(ctx);
  }

  @Get('leakage')
  @RequirePermission(...FINANCE_VIEW)
  leakage(@Ctx() ctx: RequestContext) {
    return this.svc.leakage(ctx);
  }

  @Get('patient-accounts/:patientId')
  @RequirePermission(PERMISSIONS.FINANCE_PATIENT_ACCOUNT_READ, PERMISSIONS.BILL_READ, PERMISSIONS.PATIENT_TIMELINE_READ)
  patientAccount(@Ctx() ctx: RequestContext, @Param('patientId') patientId: string) {
    return this.svc.patientAccount(ctx, patientId);
  }

  @Get('pending-charges')
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_READ)
  pendingCharges(
    @Ctx() ctx: RequestContext,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
    @Query('sourceModule') sourceModule?: string,
    @Query('q') q?: string,
  ) {
    return this.svc.pendingCharges(ctx, { patientId, status, sourceModule, q });
  }

  @Post('pending-charges')
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE)
  createCharge(@Ctx() ctx: RequestContext, @Body() dto: CreateChargeDto) {
    return this.svc.createCharge(ctx, dto);
  }

  @Post('pending-charges/:id/cancel')
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE)
  cancelCharge(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: CancelChargeDto) {
    return this.svc.cancelCharge(ctx, id, dto);
  }

  @Post('bills/from-charges')
  @RequirePermission(PERMISSIONS.FINANCE_CASHIER, PERMISSIONS.BILL_WRITE)
  billFromCharges(@Ctx() ctx: RequestContext, @Body() dto: BillFromChargesDto) {
    return this.svc.billFromCharges(ctx, dto);
  }

  @Get('bills')
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ)
  bills(@Ctx() ctx: RequestContext, @Query('status') status?: string, @Query('patientId') patientId?: string, @Query('q') q?: string) {
    return this.svc.bills(ctx, { status, patientId, q });
  }

  @Get('bills/:id')
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ)
  bill(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.bill(ctx, id);
  }

  @Post('bills/:id/payments')
  @RequirePermission(PERMISSIONS.FINANCE_CASHIER, PERMISSIONS.PAYMENT_COLLECT)
  payment(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: FinancePaymentDto) {
    return this.svc.addPayment(ctx, id, dto);
  }

  @Post('bills/:id/refunds')
  @RequirePermission(PERMISSIONS.PAYMENT_REFUND)
  refund(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: FinanceRefundDto) {
    return this.svc.refund(ctx, id, dto);
  }

  @Post('bills/:id/cancel')
  @RequirePermission(PERMISSIONS.BILL_CANCEL)
  cancelBill(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: FinanceCancelBillDto) {
    return this.svc.cancelBill(ctx, id, dto);
  }

  @Get('payments')
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_RECONCILE, PERMISSIONS.REPORTS_FINANCIAL_READ)
  payments(@Ctx() ctx: RequestContext, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.svc.payments(ctx, { startDate, endDate });
  }

  @Get('refunds')
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_RECONCILE, PERMISSIONS.PAYMENT_REFUND)
  refunds(@Ctx() ctx: RequestContext, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.svc.refunds(ctx, { startDate, endDate });
  }

  @Get('insurance-receivables')
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.INSURANCE_READ, PERMISSIONS.REPORTS_FINANCIAL_READ)
  insuranceReceivables(@Ctx() ctx: RequestContext) {
    return this.svc.insuranceReceivables(ctx);
  }

  @Get('day-close')
  @RequirePermission(PERMISSIONS.FINANCE_DAY_CLOSE, PERMISSIONS.FINANCE_RECONCILE, PERMISSIONS.REPORTS_FINANCIAL_READ)
  dayClose(@Ctx() ctx: RequestContext, @Query('date') date?: string, @Query('cashierId') cashierId?: string) {
    return this.svc.dayClose(ctx, date, cashierId);
  }

  @Post('day-close')
  @RequirePermission(PERMISSIONS.FINANCE_DAY_CLOSE)
  closeDay(@Ctx() ctx: RequestContext, @Body() dto: DayCloseDto) {
    return this.svc.closeDay(ctx, dto);
  }

  @Get('approvals')
  @RequirePermission(PERMISSIONS.FINANCE_APPROVAL_MANAGE)
  approvals(@Ctx() ctx: RequestContext, @Query('status') status?: string) {
    return this.svc.approvals(ctx, status);
  }

  @Post('approvals')
  @RequirePermission(PERMISSIONS.FINANCE_APPROVAL_MANAGE, PERMISSIONS.FINANCE_WRITE_OFF)
  requestApproval(@Ctx() ctx: RequestContext, @Body() dto: RequestApprovalDto) {
    return this.svc.requestApproval(ctx, dto);
  }

  @Post('approvals/:id/approve')
  @RequirePermission(PERMISSIONS.FINANCE_APPROVAL_MANAGE)
  approve(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ApprovalDecisionDto) {
    return this.svc.decideApproval(ctx, id, 'APPROVED', dto);
  }

  @Post('approvals/:id/reject')
  @RequirePermission(PERMISSIONS.FINANCE_APPROVAL_MANAGE)
  reject(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ApprovalDecisionDto) {
    return this.svc.decideApproval(ctx, id, 'REJECTED', dto);
  }

  @Get('reports/summary')
  @RequirePermission(PERMISSIONS.REPORTS_FINANCIAL_READ, PERMISSIONS.FINANCE_RECONCILE, PERMISSIONS.FINANCE_READ)
  reportsSummary(@Ctx() ctx: RequestContext) {
    return this.svc.reportsSummary(ctx);
  }
}
