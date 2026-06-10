import { Module } from '@nestjs/common';
import { IpdController } from './ipd.controller';
import { IpdService } from './ipd.service';
import { NursingController } from './nursing.controller';
import { NursingService } from './nursing.service';

@Module({
  controllers: [IpdController, NursingController],
  providers: [IpdService, NursingService],
})
export class IpdModule {}
