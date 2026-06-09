import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { CancelBillDto, CreateBillDto, PaymentDto, RefundDto } from './dto';

@Controller('billing')
@RequireModule(MODULES.BILLING)
export class BillingController {
  constructor(private readonly svc: BillingService) {}

  @Get('catalog')
  @RequirePermission(PERMISSIONS.BILL_READ)
  catalog(@Ctx() ctx: RequestContext) {
    return this.svc.catalog(ctx);
  }

  @Get('stats')
  @RequirePermission(PERMISSIONS.BILL_READ)
  stats(@Ctx() ctx: RequestContext) {
    return this.svc.stats(ctx);
  }

  @Get('bills')
  @RequirePermission(PERMISSIONS.BILL_READ)
  list(
    @Ctx() ctx: RequestContext,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('q') q?: string,
  ) {
    return this.svc.list(ctx, { status, patientId, q });
  }

  @Post('bills')
  @RequirePermission(PERMISSIONS.BILL_WRITE)
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateBillDto) {
    return this.svc.create(ctx, dto);
  }

  @Get('bills/:id')
  @RequirePermission(PERMISSIONS.BILL_READ)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getById(ctx, id);
  }

  @Post('bills/:id/payments')
  @RequirePermission(PERMISSIONS.PAYMENT_COLLECT)
  pay(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: PaymentDto) {
    return this.svc.addPayment(ctx, id, dto);
  }

  @Post('bills/:id/cancel')
  @RequirePermission(PERMISSIONS.BILL_CANCEL)
  cancel(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: CancelBillDto) {
    return this.svc.cancel(ctx, id, dto.reason);
  }

  @Post('bills/:id/refunds')
  @RequirePermission(PERMISSIONS.PAYMENT_REFUND)
  refund(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: RefundDto) {
    return this.svc.refund(ctx, id, dto.amount, dto.reason);
  }

  @Get('bills/:id/invoice')
  @RequirePermission(PERMISSIONS.INVOICE_PRINT)
  invoice(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.invoice(ctx, id);
  }
}
