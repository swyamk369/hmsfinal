import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [CommonModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
