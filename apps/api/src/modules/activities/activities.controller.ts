import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  activityListQuerySchema,
  createActivitySchema,
  createNoteSchema,
  type ActivityListQuery,
  type CreateActivityInput,
  type CreateNoteInput,
} from '@crm/shared';
import { RequirePermissions, Workspace } from '../../common/decorators';
import type { WorkspaceContext } from '../../common/types';
import { optionalUuid, ZBody, ZQuery } from '../../common/zod';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { ActivitiesService } from './activities.service';

@ApiTags('Activities & notes')
@UseGuards(WorkspaceGuard)
@RequirePermissions('records:read')
@Controller('workspaces/:workspaceId')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get('activities')
  list(@Workspace() ctx: WorkspaceContext, @ZQuery(activityListQuerySchema) query: ActivityListQuery) {
    return this.activities.list(ctx, query);
  }

  @Post('activities')
  @RequirePermissions('records:create')
  create(@Workspace() ctx: WorkspaceContext, @ZBody(createActivitySchema) body: CreateActivityInput) {
    return this.activities.create(ctx, body);
  }

  @Delete('activities/:id')
  @HttpCode(204)
  @RequirePermissions('records:update_own')
  async remove(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.activities.remove(ctx, id);
  }

  @Get('notes')
  notes(
    @Workspace() ctx: WorkspaceContext,
    @Query('customerId') customerId?: string,
    @Query('leadId') leadId?: string,
    @Query('dealId') dealId?: string,
  ) {
    return this.activities.notes(ctx, {
      customerId: optionalUuid(customerId, 'customerId'),
      leadId: optionalUuid(leadId, 'leadId'),
      dealId: optionalUuid(dealId, 'dealId'),
    });
  }

  @Post('notes')
  @RequirePermissions('records:create')
  createNote(@Workspace() ctx: WorkspaceContext, @ZBody(createNoteSchema) body: CreateNoteInput) {
    return this.activities.createNote(ctx, body);
  }

  @Delete('notes/:id')
  @HttpCode(204)
  @RequirePermissions('records:update_own')
  async removeNote(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.activities.removeNote(ctx, id);
  }

  @Get('customers/:customerId/timeline')
  timeline(@Workspace() ctx: WorkspaceContext, @Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.activities.customerTimeline(ctx, customerId);
  }
}
