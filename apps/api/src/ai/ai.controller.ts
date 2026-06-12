import { Body, Controller, Headers, Post, Res } from '@nestjs/common';
import { AiService, ChatRequestDto } from './ai.service';
import { Ctx, Public } from '../common/decorators';
import type { RequestContext } from '../common/types';
import type { Response } from 'express';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Public()
  @Post('chat')
  async chat(
    @Ctx() ctx: RequestContext,
    @Body() dto: ChatRequestDto,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-hms-path') currentPath: string | undefined,
    @Res() res: Response,
  ) {
    const webResponse = await this.aiService.handleChatStream(ctx, dto.messages, {
      authorization,
      tenantId,
      currentPath,
    });

    webResponse.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(webResponse.status);

    if (!webResponse.body) {
      res.end();
      return;
    }

    const reader = webResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  }
}
