import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PublicService } from './public.service';

/**
 * Phase 22.3 — PUBLIC, no-auth directory. @Public bypasses the auth guard; no
 * @RequirePermission / @RequireModule, so the permission/module/tenant guards all
 * pass through. Returns public-safe data only.
 */
@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly svc: PublicService) {}

  @Get('search')
  search(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('city') city?: string,
    @Query('specialty') specialty?: string,
  ) {
    return this.svc.search({ q, type, city, specialty });
  }

  @Get('search/suggestions')
  suggestions(@Query('q') q = '') {
    return this.svc.suggestions(q);
  }

  @Get('hospitals')
  hospitals(@Query('q') q?: string, @Query('city') city?: string) {
    return this.svc.hospitals({ q, city });
  }

  @Get('hospitals/:slug')
  hospital(@Param('slug') slug: string) {
    return this.svc.hospitalBySlug(slug);
  }

  @Get('doctors')
  doctors(@Query('q') q?: string, @Query('specialty') specialty?: string, @Query('city') city?: string) {
    return this.svc.doctors({ q, specialty, city });
  }

  @Get('doctors/:slug')
  doctor(@Param('slug') slug: string) {
    return this.svc.doctorBySlug(slug);
  }
}
