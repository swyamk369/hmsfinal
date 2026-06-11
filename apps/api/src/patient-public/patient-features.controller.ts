import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PatientFeaturesService } from './patient-features.service';
import {
  SaveProviderDto,
  SaveHospitalDto,
  FamilyMemberDto,
  UpdateProfileDto,
  NotificationPrefsDto,
  CreateRefillDto,
} from './dto';

/**
 * Phase 23 — patient-portal extras. @Public (staff auth guard doesn't apply); the service verifies
 * the patient's OWN Firebase token and scopes by uid (global data) or assertAccess (tenant data).
 */
@Public()
@Controller('patient-portal')
export class PatientFeaturesController {
  constructor(private readonly svc: PatientFeaturesService) {}

  // Care Team
  @Get('saved-providers')
  listSavedProviders(@Headers('authorization') auth?: string) {
    return this.svc.listSavedProviders(auth);
  }
  @Post('saved-providers')
  saveProvider(@Headers('authorization') auth: string, @Body() dto: SaveProviderDto) {
    return this.svc.saveProvider(auth, dto);
  }
  @Delete('saved-providers/:id')
  removeSavedProvider(@Headers('authorization') auth: string, @Param('id') id: string) {
    return this.svc.removeSavedProvider(auth, id);
  }

  @Get('saved-hospitals')
  listSavedHospitals(@Headers('authorization') auth?: string) {
    return this.svc.listSavedHospitals(auth);
  }
  @Post('saved-hospitals')
  saveHospital(@Headers('authorization') auth: string, @Body() dto: SaveHospitalDto) {
    return this.svc.saveHospital(auth, dto);
  }
  @Delete('saved-hospitals/:id')
  removeSavedHospital(@Headers('authorization') auth: string, @Param('id') id: string) {
    return this.svc.removeSavedHospital(auth, id);
  }

  // Family
  @Get('family')
  listFamily(@Headers('authorization') auth?: string) {
    return this.svc.listFamily(auth);
  }
  @Post('family')
  addFamily(@Headers('authorization') auth: string, @Body() dto: FamilyMemberDto) {
    return this.svc.addFamily(auth, dto);
  }
  @Patch('family/:id')
  updateFamily(@Headers('authorization') auth: string, @Param('id') id: string, @Body() dto: FamilyMemberDto) {
    return this.svc.updateFamily(auth, id, dto);
  }
  @Delete('family/:id')
  removeFamily(@Headers('authorization') auth: string, @Param('id') id: string) {
    return this.svc.removeFamily(auth, id);
  }

  // Notifications
  @Get('notifications')
  listNotifications(@Headers('authorization') auth?: string) {
    return this.svc.listNotifications(auth);
  }
  @Post('notifications/:id/read')
  markRead(@Headers('authorization') auth: string, @Param('id') id: string) {
    return this.svc.markNotificationRead(auth, id);
  }
  @Post('notifications/read-all')
  markAllRead(@Headers('authorization') auth?: string) {
    return this.svc.markAllNotificationsRead(auth);
  }

  // Settings
  @Get('settings')
  getSettings(@Headers('authorization') auth?: string) {
    return this.svc.getSettings(auth);
  }
  @Patch('settings/profile')
  updateProfile(@Headers('authorization') auth: string, @Body() dto: UpdateProfileDto) {
    return this.svc.updateProfile(auth, dto);
  }
  @Patch('settings/notifications')
  updatePrefs(@Headers('authorization') auth: string, @Body() dto: NotificationPrefsDto) {
    return this.svc.updateNotificationPrefs(auth, dto);
  }

  // Refills (tenant-scoped)
  @Get('refills')
  listRefills(@Headers('authorization') auth: string, @Query('tenantId') tenantId: string) {
    return this.svc.listRefills(auth, tenantId);
  }
  @Post('refills')
  createRefill(@Headers('authorization') auth: string, @Body() dto: CreateRefillDto) {
    return this.svc.createRefill(auth, dto);
  }

  // Clinical record / lab-result detail
  @Get('reports/:id')
  reportDetail(@Headers('authorization') auth: string, @Query('tenantId') tenantId: string, @Param('id') id: string) {
    return this.svc.reportDetail(auth, tenantId, id);
  }
}
