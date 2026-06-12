import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SupportModule } from '../support/support.module';
import { SupportService } from '../support/support.service';

@Module({
  imports: [SupportModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
