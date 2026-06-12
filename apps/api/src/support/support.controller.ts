import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SupportService, CreateTicketDto, AddCommentDto } from './support.service';
import { Ctx } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { TicketStatus } from '@hms/db';

@Controller('support')
export class SupportController {
  constructor(private readonly svc: SupportService) {}

  @Get('tickets')
  list(@Ctx() ctx: RequestContext) {
    return this.svc.listTickets(ctx);
  }

  @Post('tickets')
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateTicketDto) {
    return this.svc.createTicket(ctx, dto);
  }

  @Get('tickets/:id')
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getTicket(ctx, id);
  }

  @Patch('tickets/:id/status')
  updateStatus(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body('status') status: TicketStatus) {
    return this.svc.updateTicketStatus(ctx, id, status);
  }

  @Post('tickets/:id/comments')
  addComment(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: AddCommentDto) {
    return this.svc.addComment(ctx, id, dto);
  }
}
