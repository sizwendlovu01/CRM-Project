import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  boardQuerySchema,
  createDealSchema,
  dealListQuerySchema,
  moveDealSchema,
  updateDealSchema,
  type CreateDealInput,
  type DealListQuery,
  type MoveDealInput,
  type UpdateDealInput,
} from '@crm/shared';
import type { z } from 'zod';
import { RequirePermissions, Workspace } from '../../common/decorators';
import type { WorkspaceContext } from '../../common/types';
import { ZBody, ZQuery } from '../../common/zod';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { DealsService } from './deals.service';

@ApiTags('Deals')
@UseGuards(WorkspaceGuard)
@RequirePermissions('records:read')
@Controller('workspaces/:workspaceId')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get('pipelines/:pipelineId/board')
  board(
    @Workspace() ctx: WorkspaceContext,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @ZQuery(boardQuerySchema) query: z.infer<typeof boardQuerySchema>,
  ) {
    return this.deals.board(ctx, pipelineId, query);
  }

  @Get('deals')
  list(@Workspace() ctx: WorkspaceContext, @ZQuery(dealListQuerySchema) query: DealListQuery) {
    return this.deals.list(ctx, query);
  }

  @Get('deals/:id')
  get(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.get(ctx, id);
  }

  @Post('deals')
  @RequirePermissions('records:create')
  create(@Workspace() ctx: WorkspaceContext, @ZBody(createDealSchema) body: CreateDealInput) {
    return this.deals.create(ctx, body);
  }

  @Patch('deals/:id')
  @RequirePermissions('records:update_own')
  update(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string, @ZBody(updateDealSchema) body: UpdateDealInput) {
    return this.deals.update(ctx, id, body);
  }

  @Post('deals/:id/move')
  @HttpCode(200)
  @RequirePermissions('records:update_own')
  move(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string, @ZBody(moveDealSchema) body: MoveDealInput) {
    return this.deals.move(ctx, id, body);
  }

  @Post('deals/:id/archive')
  @HttpCode(200)
  @RequirePermissions('records:update_own')
  archive(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.setArchived(ctx, id, true);
  }

  @Post('deals/:id/restore')
  @HttpCode(200)
  @RequirePermissions('records:update_own')
  restore(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.setArchived(ctx, id, false);
  }

  @Delete('deals/:id')
  @HttpCode(204)
  @RequirePermissions('records:delete_any')
  async remove(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.deals.remove(ctx, id);
  }
}
