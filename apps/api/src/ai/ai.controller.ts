import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { AiService, ChatRequestDto } from './ai.service';
import { Ctx } from '../common/decorators';
import type { RequestContext } from '../common/types';
import type { Request, Response } from 'express';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Ctx() ctx: RequestContext, @Body() dto: ChatRequestDto, @Req() req: Request, @Res() res: Response) {
    const webResponse = await this.aiService.handleChatStream(ctx, dto.messages);
    
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
