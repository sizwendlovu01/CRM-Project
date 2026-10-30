import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createPipelineSchema,
  createStageSchema,
  deleteStageQuerySchema,
  reorderStagesSchema,
  updatePipelineSchema,
  updateStageSchema,
} from '@crm/shared';
import type { z } from 'zod';
import { RequirePermissions, Workspace } from '../../common/decorators';
import type { WorkspaceContext } from '../../common/types';
import { ZBody, ZQuery } from '../../common/zod';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { PipelinesService } from './pipelines.service';

@ApiTags('Pipelines')
@UseGuards(WorkspaceGuard)
@RequirePermissions('records:read')
@Controller('workspaces/:workspaceId/pipelines')
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

  @Get()
  list(@Workspace() ctx: WorkspaceContext) {
    return this.pipelines.list(ctx);
  }

  @Get(':pipelineId')
  get(@Workspace() ctx: WorkspaceContext, @Param('pipelineId', ParseUUIDPipe) id: string) {
    return this.pipelines.get(ctx, id);
  }

  @Post()
  @RequirePermissions('pipelines:manage')
  create(@Workspace() ctx: WorkspaceContext, @ZBody(createPipelineSchema) body: z.infer<typeof createPipelineSchema>) {
    return this.pipelines.create(ctx, body.name);
  }

  @Patch(':pipelineId')
  @RequirePermissions('pipelines:manage')
  update(
    @Workspace() ctx: WorkspaceContext,
    @Param('pipelineId', ParseUUIDPipe) id: string,
    @ZBody(updatePipelineSchema) body: z.infer<typeof updatePipelineSchema>,
  ) {
    return this.pipelines.update(ctx, id, body);
  }

  @Delete(':pipelineId')
  @HttpCode(204)
  @RequirePermissions('pipelines:manage')
  async remove(@Workspace() ctx: WorkspaceContext, @Param('pipelineId', ParseUUIDPipe) id: string) {
    await this.pipelines.remove(ctx, id);
  }

  @Post(':pipelineId/stages')
  @RequirePermissions('pipelines:manage')
  createStage(
    @Workspace() ctx: WorkspaceContext,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @ZBody(createStageSchema) body: z.infer<typeof createStageSchema>,
  ) {
    return this.pipelines.createStage(ctx, pipelineId, body);
  }

  @Put(':pipelineId/stages/order')
  @RequirePermissions('pipelines:manage')
  reorder(
    @Workspace() ctx: WorkspaceContext,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @ZBody(reorderStagesSchema) body: z.infer<typeof reorderStagesSchema>,
  ) {
    return this.pipelines.reorderStages(ctx, pipelineId, body.stageIds);
  }

  @Patch(':pipelineId/stages/:stageId')
  @RequirePermissions('pipelines:manage')
  updateStage(
    @Workspace() ctx: WorkspaceContext,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @ZBody(updateStageSchema) body: z.infer<typeof updateStageSchema>,
  ) {
    return this.pipelines.updateStage(ctx, pipelineId, stageId, body);
  }

  @Delete(':pipelineId/stages/:stageId')
  @HttpCode(204)
  @RequirePermissions('pipelines:manage')
  async removeStage(
    @Workspace() ctx: WorkspaceContext,
    @Param('pipelineId', ParseUUIDPipe) pipelineId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @ZQuery(deleteStageQuerySchema) query: z.infer<typeof deleteStageQuerySchema>,
  ) {
    await this.pipelines.removeStage(ctx, pipelineId, stageId, query.moveDealsToStageId);
  }
}
