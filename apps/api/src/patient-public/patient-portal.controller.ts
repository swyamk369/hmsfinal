import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PatientPortalService } from './patient-portal.service';
import { RequestAccessDto } from './dto';

/**
 * Phase 22.5 — Patient portal. @Public (the staff auth guard doesn't apply); the service
 * verifies the patient's own Firebase token and enforces uid↔tenant↔patient access.
 */
@Public()
@Controller('patient-portal')
export class PatientPortalController {
  constructor(private readonly svc: PatientPortalService) {}

  @Get('me')
  me(@Headers('authorization') auth?: string) {
    return this.svc.me(auth);
  }

  @Get('linked-hospitals')
  linkedHospitals(@Headers('authorization') auth?: string) {
    return this.svc.linkedHospitals(auth);
  }

  @Get('dashboard')
  dashboard(@Headers('authorization') auth: string, @Query('tenantId') tenantId: string) {
    return this.svc.dashboard(auth, tenantId);
  }

  @Get('appointments')
  appointments(@Headers('authorization') auth: string, @Query('tenantId') tenantId: string) {
    return this.svc.appointments(auth, tenantId);
  }

  @Get('bills')
  bills(@Headers('authorization') auth: string, @Query('tenantId') tenantId: string) {
    return this.svc.bills(auth, tenantId);
  }

  @Get('reports')
  reports(@Headers('authorization') auth: string, @Query('tenantId') tenantId: string) {
    return this.svc.reports(auth, tenantId);
  }

  @Get('documents')
  documents(@Headers('authorization') auth: string, @Query('tenantId') tenantId: string) {
    return this.svc.documents(auth, tenantId);
  }

  @Get('profile')
  profile(@Headers('authorization') auth: string, @Query('tenantId') tenantId: string) {
    return this.svc.profile(auth, tenantId);
  }

  @Get('prescriptions')
  prescriptions(@Headers('authorization') auth: string, @Query('tenantId') tenantId: string) {
    return this.svc.prescriptions(auth, tenantId);
  }

  @Post('documents/:id/viewed')
  documentViewed(@Headers('authorization') auth: string, @Query('tenantId') tenantId: string, @Param('id') id: string) {
    return this.svc.markDocumentViewed(auth, tenantId, id);
  }

  @Post('request-access')
  requestAccess(@Headers('authorization') auth: string, @Body() dto: RequestAccessDto) {
    return this.svc.requestAccess(auth, dto);
  }
}
