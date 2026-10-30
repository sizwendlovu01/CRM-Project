import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  convertLeadSchema,
  createLeadSchema,
  leadListQuerySchema,
  updateLeadSchema,
  type ConvertLeadInput,
  type CreateLeadInput,
  type LeadListQuery,
  type UpdateLeadInput,
} from '@crm/shared';
import { RequirePermissions, Workspace } from '../../common/decorators';
import type { WorkspaceContext } from '../../common/types';
import { ZBody, ZQuery } from '../../common/zod';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { LeadsService } from './leads.service';

@ApiTags('Leads')
@UseGuards(WorkspaceGuard)
@RequirePermissions('records:read')
@Controller('workspaces/:workspaceId/leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@Workspace() ctx: WorkspaceContext, @ZQuery(leadListQuerySchema) query: LeadListQuery) {
    return this.leads.list(ctx, query);
  }

  @Get(':id')
  get(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.get(ctx, id);
  }

  @Post()
  @RequirePermissions('records:create')
  create(@Workspace() ctx: WorkspaceContext, @ZBody(createLeadSchema) body: CreateLeadInput) {
    return this.leads.create(ctx, body);
  }

  @Patch(':id')
  @RequirePermissions('records:update_own')
  update(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string, @ZBody(updateLeadSchema) body: UpdateLeadInput) {
    return this.leads.update(ctx, id, body);
  }

  @Post(':id/convert')
  @HttpCode(200)
  @RequirePermissions('records:update_own', 'records:create')
  convert(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string, @ZBody(convertLeadSchema) body: ConvertLeadInput) {
    return this.leads.convert(ctx, id, body);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @RequirePermissions('records:update_own')
  archive(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.setArchived(ctx, id, true);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermissions('records:update_own')
  restore(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.setArchived(ctx, id, false);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('records:delete_any')
  async remove(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.leads.remove(ctx, id);
  }
}
