import { Module } from '@nestjs/common';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { EncounterController } from './encounter.controller';
import { EncounterService } from './encounter.service';
import { PrescriptionController } from './prescription.controller';
import { DirectoryController } from './directory.controller';

@Module({
  controllers: [AppointmentController, EncounterController, PrescriptionController, DirectoryController],
  providers: [AppointmentService, EncounterService],
})
export class OpdModule {}
