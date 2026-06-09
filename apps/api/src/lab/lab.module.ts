import { Module } from '@nestjs/common';
import { LabController } from './lab.controller';
import { EncounterLabController } from './encounter-lab.controller';
import { LabService } from './lab.service';

@Module({
  controllers: [LabController, EncounterLabController],
  providers: [LabService],
  exports: [LabService],
})
export class LabModule {}
