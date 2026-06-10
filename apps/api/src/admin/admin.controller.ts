import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import {
  AuditQueryDto,
  CreateBedDto,
  CreateCatalogItemDto,
  CreateDepartmentDto,
  CreateFacilityDto,
  CreateWardDto,
  UpdateBedDto,
  UpdateCatalogItemDto,
  UpdateDepartmentDto,
  UpdateFacilityDto,
  UpdateProfileDto,
  UpdateWardDto,
} from './dto';

/**
 * Hospital Admin setup. Every route runs through the global guard chain
 * (auth → tenant/status → permission → module). The ADMIN module is enabled for
 * every tenant, so these routes are always reachable by a Hospital Admin.
 */
@Controller('admin')
@RequireModule(MODULES.ADMIN)
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  @Get('overview')
  @RequirePermission(PERMISSIONS.SETTINGS_READ)
  overview(@Ctx() ctx: RequestContext) {
    return this.svc.getOverview(ctx);
  }

  // ── Profile ─────────────────────────────────────────────────
  @Get('profile')
  @RequirePermission(PERMISSIONS.SETTINGS_READ)
  getProfile(@Ctx() ctx: RequestContext) {
    return this.svc.getProfile(ctx);
  }

  @Patch('profile')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  updateProfile(@Ctx() ctx: RequestContext, @Body() dto: UpdateProfileDto) {
    return this.svc.updateProfile(ctx, dto);
  }

  // ── Facilities ──────────────────────────────────────────────
  @Get('facilities')
  @RequirePermission(PERMISSIONS.FACILITY_READ)
  listFacilities(@Ctx() ctx: RequestContext) {
    return this.svc.listFacilities(ctx);
  }

  @Post('facilities')
  @RequirePermission(PERMISSIONS.FACILITY_WRITE)
  createFacility(@Ctx() ctx: RequestContext, @Body() dto: CreateFacilityDto) {
    return this.svc.createFacility(ctx, dto);
  }

  @Patch('facilities/:id')
  @RequirePermission(PERMISSIONS.FACILITY_WRITE)
  updateFacility(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateFacilityDto) {
    return this.svc.updateFacility(ctx, id, dto);
  }

  // ── Departments ─────────────────────────────────────────────
  @Get('departments')
  @RequirePermission(PERMISSIONS.DEPARTMENT_READ)
  listDepartments(@Ctx() ctx: RequestContext) {
    return this.svc.listDepartments(ctx);
  }

  @Post('departments')
  @RequirePermission(PERMISSIONS.DEPARTMENT_WRITE)
  createDepartment(@Ctx() ctx: RequestContext, @Body() dto: CreateDepartmentDto) {
    return this.svc.createDepartment(ctx, dto);
  }

  @Patch('departments/:id')
  @RequirePermission(PERMISSIONS.DEPARTMENT_WRITE)
  updateDepartment(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.svc.updateDepartment(ctx, id, dto);
  }

  // ── Service catalog ─────────────────────────────────────────
  @Get('catalog')
  @RequirePermission(PERMISSIONS.SETTINGS_READ)
  listCatalog(@Ctx() ctx: RequestContext) {
    return this.svc.listCatalog(ctx);
  }

  @Post('catalog')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  createCatalogItem(@Ctx() ctx: RequestContext, @Body() dto: CreateCatalogItemDto) {
    return this.svc.createCatalogItem(ctx, dto);
  }

  @Patch('catalog/:id')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  updateCatalogItem(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateCatalogItemDto) {
    return this.svc.updateCatalogItem(ctx, id, dto);
  }

  // ── Wards ───────────────────────────────────────────────────
  @Get('wards')
  @RequirePermission(PERMISSIONS.WARD_MANAGE)
  listWards(@Ctx() ctx: RequestContext) {
    return this.svc.listWards(ctx);
  }

  @Post('wards')
  @RequirePermission(PERMISSIONS.WARD_MANAGE)
  createWard(@Ctx() ctx: RequestContext, @Body() dto: CreateWardDto) {
    return this.svc.createWard(ctx, dto);
  }

  @Patch('wards/:id')
  @RequirePermission(PERMISSIONS.WARD_MANAGE)
  updateWard(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateWardDto) {
    return this.svc.updateWard(ctx, id, dto);
  }

  // ── Beds ────────────────────────────────────────────────────
  @Get('beds')
  @RequirePermission(PERMISSIONS.BED_MANAGE)
  listBeds(@Ctx() ctx: RequestContext, @Query('wardId') wardId?: string) {
    return this.svc.listBeds(ctx, wardId);
  }

  @Post('beds')
  @RequirePermission(PERMISSIONS.BED_MANAGE)
  createBed(@Ctx() ctx: RequestContext, @Body() dto: CreateBedDto) {
    return this.svc.createBed(ctx, dto);
  }

  @Patch('beds/:id')
  @RequirePermission(PERMISSIONS.BED_MANAGE)
  updateBed(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateBedDto) {
    return this.svc.updateBed(ctx, id, dto);
  }
  // ── Audit search (read-only) ────────────────────────────────
  @Get('audit')
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  searchAudit(@Ctx() ctx: RequestContext, @Query() q: AuditQueryDto) {
    return this.svc.searchAudit(ctx, q);
  }
}
