import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createCommentSchema,
  createTaskSchema,
  taskListQuerySchema,
  updateTaskSchema,
  type CreateTaskInput,
  type TaskListQuery,
  type UpdateTaskInput,
} from '@crm/shared';
import type { z } from 'zod';
import { RequirePermissions, Workspace } from '../../common/decorators';
import type { WorkspaceContext } from '../../common/types';
import { ZBody, ZQuery } from '../../common/zod';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@UseGuards(WorkspaceGuard)
@RequirePermissions('records:read')
@Controller('workspaces/:workspaceId/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Workspace() ctx: WorkspaceContext, @ZQuery(taskListQuerySchema) query: TaskListQuery) {
    return this.tasks.list(ctx, query);
  }

  @Get(':id')
  get(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.get(ctx, id);
  }

  @Post()
  @RequirePermissions('records:create')
  create(@Workspace() ctx: WorkspaceContext, @ZBody(createTaskSchema) body: CreateTaskInput) {
    return this.tasks.create(ctx, body);
  }

  @Patch(':id')
  @RequirePermissions('records:update_own')
  update(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string, @ZBody(updateTaskSchema) body: UpdateTaskInput) {
    return this.tasks.update(ctx, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('records:update_own')
  async remove(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.tasks.remove(ctx, id);
  }

  @Get(':id/comments')
  comments(@Workspace() ctx: WorkspaceContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.comments(ctx, id);
  }

  @Post(':id/comments')
  @RequirePermissions('records:create')
  addComment(
    @Workspace() ctx: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
    @ZBody(createCommentSchema) body: z.infer<typeof createCommentSchema>,
  ) {
    return this.tasks.addComment(ctx, id, body.body);
  }

  @Delete(':id/comments/:commentId')
  @HttpCode(204)
  @RequirePermissions('records:update_own')
  async removeComment(
    @Workspace() ctx: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    await this.tasks.removeComment(ctx, id, commentId);
  }
}
