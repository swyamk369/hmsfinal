import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Ctx } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { NotificationQueryDto, UpdatePreferencesDto } from './dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@Ctx() ctx: RequestContext, @Query() q: NotificationQueryDto) {
    return this.svc.list(ctx, q);
  }

  @Get('unread-count')
  unreadCount(@Ctx() ctx: RequestContext) {
    return this.svc.unreadCount(ctx);
  }

  @Get('preferences')
  preferences(@Ctx() ctx: RequestContext) {
    return this.svc.preferences(ctx);
  }

  @Post('preferences')
  updatePreferences(@Ctx() ctx: RequestContext, @Body() dto: UpdatePreferencesDto) {
    return this.svc.updatePreferences(ctx, dto);
  }

  @Post('read-all')
  readAll(@Ctx() ctx: RequestContext) {
    return this.svc.readAll(ctx);
  }

  @Post(':id/read')
  markRead(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.markRead(ctx, id);
  }

  @Post(':id/archive')
  archive(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.archive(ctx, id);
  }
}
