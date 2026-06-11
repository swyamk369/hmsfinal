import { Module } from '@nestjs/common';
import { HmsPublicController } from './hms-public.controller';
import { HmsPublicService } from './hms-public.service';
import { SearchIndexService } from './search-index.service';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { PatientPortalController } from './patient-portal.controller';
import { PatientPortalService } from './patient-portal.service';

@Module({
  controllers: [HmsPublicController, PublicController, BookingController, PatientPortalController],
  providers: [HmsPublicService, SearchIndexService, PublicService, BookingService, PatientPortalService],
})
export class PatientPublicModule {}
