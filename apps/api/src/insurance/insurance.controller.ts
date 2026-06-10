import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { MODULES, PERMISSIONS } from '@hms/db';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { InsuranceService } from './insurance.service';
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

@Controller('insurance')
@RequireModule(MODULES.INSURANCE)
export class InsuranceController {
  constructor(private readonly svc: InsuranceService) {}

  @Get('providers')
  @RequirePermission(PERMISSIONS.INSURANCE_READ)
  providers(@Ctx() ctx: RequestContext) {
    return this.svc.providers(ctx);
  }

  @Get('policies')
  @RequirePermission(PERMISSIONS.INSURANCE_READ)
  policies(@Ctx() ctx: RequestContext, @Query('patientId') patientId?: string, @Query('q') q?: string) {
    return this.svc.listPolicies(ctx, { patientId, q });
  }

  @Post('policies')
  @RequirePermission(PERMISSIONS.INSURANCE_POLICY_MANAGE)
  createPolicy(@Ctx() ctx: RequestContext, @Body() dto: CreatePolicyDto) {
    return this.svc.createPolicy(ctx, dto);
  }

  @Patch('policies/:id')
  @RequirePermission(PERMISSIONS.INSURANCE_POLICY_MANAGE)
  updatePolicy(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdatePolicyDto) {
    return this.svc.updatePolicy(ctx, id, dto);
  }

  @Get('bills')
  @RequirePermission(PERMISSIONS.INSURANCE_READ)
  bills(@Ctx() ctx: RequestContext, @Query('patientId') patientId?: string, @Query('q') q?: string) {
    return this.svc.eligibleBills(ctx, { patientId, q });
  }

  @Get('claims')
  @RequirePermission(PERMISSIONS.INSURANCE_READ)
  claims(@Ctx() ctx: RequestContext, @Query('status') status?: string, @Query('q') q?: string) {
    return this.svc.listClaims(ctx, { status, q });
  }

  @Post('claims')
  @RequirePermission(PERMISSIONS.INSURANCE_CLAIM_CREATE)
  createClaim(@Ctx() ctx: RequestContext, @Body() dto: CreateClaimDto) {
    return this.svc.createClaim(ctx, dto);
  }

  @Get('claims/:id')
  @RequirePermission(PERMISSIONS.INSURANCE_READ)
  getClaim(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getClaim(ctx, id);
  }

  @Patch('claims/:id')
  @RequirePermission(PERMISSIONS.INSURANCE_CLAIM_UPDATE)
  updateClaim(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ClaimNotesDto) {
    return this.svc.updateNotes(ctx, id, dto);
  }

  @Post('claims/:id/submit')
  @RequirePermission(PERMISSIONS.INSURANCE_CLAIM_UPDATE)
  submit(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ClaimReviewDto) {
    return this.svc.submit(ctx, id, dto);
  }

  @Post('claims/:id/review')
  @RequirePermission(PERMISSIONS.INSURANCE_CLAIM_UPDATE)
  review(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ClaimReviewDto) {
    return this.svc.markUnderReview(ctx, id, dto);
  }

  @Post('claims/:id/approve')
  @RequirePermission(PERMISSIONS.INSURANCE_CLAIM_APPROVE)
  approve(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ApproveClaimDto) {
    return this.svc.approve(ctx, id, dto);
  }

  @Post('claims/:id/reject')
  @RequirePermission(PERMISSIONS.INSURANCE_CLAIM_APPROVE)
  reject(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: RejectClaimDto) {
    return this.svc.reject(ctx, id, dto);
  }

  @Post('claims/:id/settle')
  @RequirePermission(PERMISSIONS.INSURANCE_CLAIM_SETTLE)
  settle(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: SettleClaimDto) {
    return this.svc.settle(ctx, id, dto);
  }

  @Post('claims/:id/cancel')
  @RequirePermission(PERMISSIONS.INSURANCE_CLAIM_UPDATE)
  cancel(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: CancelClaimDto) {
    return this.svc.cancel(ctx, id, dto);
  }

  @Get('receivables')
  @RequirePermission(PERMISSIONS.INSURANCE_READ)
  receivables(@Ctx() ctx: RequestContext) {
    return this.svc.receivables(ctx);
  }
}
