import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { notificationListQuerySchema, updateNotificationPreferencesSchema } from '@crm/shared';
import type { z } from 'zod';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import { optionalUuid, ZBody, ZQuery } from '../../common/zod';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @ZQuery(notificationListQuerySchema) query: z.infer<typeof notificationListQuerySchema>,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.notifications.list(user.id, query, optionalUuid(workspaceId, 'workspaceId'));
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser, @Query('workspaceId') workspaceId?: string) {
    return { count: await this.notifications.unreadCount(user.id, optionalUuid(workspaceId, 'workspaceId')) };
  }

  @Post('read-all')
  @HttpCode(200)
  async markAllRead(@CurrentUser() user: AuthUser, @Query('workspaceId') workspaceId?: string) {
    return { updated: await this.notifications.markAllRead(user.id, optionalUuid(workspaceId, 'workspaceId')) };
  }

  @Post(':id/read')
  @HttpCode(204)
  async markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.notifications.markRead(user.id, id);
  }

  @Post(':id/unread')
  @HttpCode(204)
  async markUnread(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.notifications.markUnread(user.id, id);
  }

  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.notifications.getPreferences(user.id);
  }

  @Put('preferences')
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @ZBody(updateNotificationPreferencesSchema) body: z.infer<typeof updateNotificationPreferencesSchema>,
  ) {
    return this.notifications.updatePreferences(user.id, body.preferences);
  }
}
