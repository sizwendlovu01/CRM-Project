import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  transferOwnershipSchema,
  updateMemberRoleSchema,
  updateWorkspaceSchema,
} from '@crm/shared';
import { z } from 'zod';
import { CurrentUser, Public, RequirePermissions, Workspace } from '../../common/decorators';
import type { AuthUser, WorkspaceContext } from '../../common/types';
import { ZBody } from '../../common/zod';
import { WorkspaceGuard } from './workspace.guard';
import { WorkspacesService } from './workspaces.service';

const deleteWorkspaceSchema = z.object({ confirmName: z.string().min(1).max(80) });

@ApiTags('Workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @ZBody(createWorkspaceSchema) body: z.infer<typeof createWorkspaceSchema>) {
    return this.workspaces.create(user, body.name);
  }

  @UseGuards(WorkspaceGuard)
  @Get(':workspaceId')
  detail(@Workspace() ctx: WorkspaceContext) {
    return this.workspaces.detail(ctx);
  }

  @UseGuards(WorkspaceGuard)
  @RequirePermissions('workspace:update')
  @Patch(':workspaceId')
  update(@Workspace() ctx: WorkspaceContext, @ZBody(updateWorkspaceSchema) body: z.infer<typeof updateWorkspaceSchema>) {
    return this.workspaces.update(ctx, body);
  }

  @UseGuards(WorkspaceGuard)
  @RequirePermissions('workspace:delete')
  @Post(':workspaceId/delete')
  @HttpCode(204)
  async remove(@Workspace() ctx: WorkspaceContext, @ZBody(deleteWorkspaceSchema) body: z.infer<typeof deleteWorkspaceSchema>) {
    await this.workspaces.remove(ctx, body.confirmName);
  }

  @UseGuards(WorkspaceGuard)
  @Post(':workspaceId/leave')
  @HttpCode(204)
  async leave(@Workspace() ctx: WorkspaceContext) {
    await this.workspaces.leave(ctx);
  }

  @UseGuards(WorkspaceGuard)
  @RequirePermissions('members:read')
  @Get(':workspaceId/members')
  members(@Workspace() ctx: WorkspaceContext) {
    return this.workspaces.members(ctx);
  }

  @UseGuards(WorkspaceGuard)
  @RequirePermissions('members:manage')
  @Patch(':workspaceId/members/:memberId')
  changeRole(
    @Workspace() ctx: WorkspaceContext,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @ZBody(updateMemberRoleSchema) body: z.infer<typeof updateMemberRoleSchema>,
  ) {
    return this.workspaces.changeRole(ctx, memberId, body.role);
  }

  @UseGuards(WorkspaceGuard)
  @RequirePermissions('members:manage')
  @Delete(':workspaceId/members/:memberId')
  @HttpCode(204)
  async removeMember(@Workspace() ctx: WorkspaceContext, @Param('memberId', ParseUUIDPipe) memberId: string) {
    await this.workspaces.removeMember(ctx, memberId);
  }

  @UseGuards(WorkspaceGuard)
  @Post(':workspaceId/transfer-ownership')
  @HttpCode(200)
  transfer(@Workspace() ctx: WorkspaceContext, @ZBody(transferOwnershipSchema) body: z.infer<typeof transferOwnershipSchema>) {
    return this.workspaces.transferOwnership(ctx, body.userId);
  }

  @UseGuards(WorkspaceGuard)
  @RequirePermissions('members:invite')
  @Get(':workspaceId/invitations')
  invitations(@Workspace() ctx: WorkspaceContext) {
    return this.workspaces.invitations(ctx);
  }

  @UseGuards(WorkspaceGuard)
  @RequirePermissions('members:invite')
  @Post(':workspaceId/invitations')
  invite(
    @Workspace() ctx: WorkspaceContext,
    @CurrentUser() user: AuthUser,
    @ZBody(inviteMemberSchema) body: z.infer<typeof inviteMemberSchema>,
  ) {
    return this.workspaces.invite(ctx, user, body.email, body.role);
  }

  @UseGuards(WorkspaceGuard)
  @RequirePermissions('members:invite')
  @Post(':workspaceId/invitations/:invitationId/resend')
  @HttpCode(200)
  resend(@Workspace() ctx: WorkspaceContext, @CurrentUser() user: AuthUser, @Param('invitationId', ParseUUIDPipe) id: string) {
    return this.workspaces.resendInvitation(ctx, user, id);
  }

  @UseGuards(WorkspaceGuard)
  @RequirePermissions('members:invite')
  @Delete(':workspaceId/invitations/:invitationId')
  @HttpCode(204)
  async revoke(@Workspace() ctx: WorkspaceContext, @Param('invitationId', ParseUUIDPipe) id: string) {
    await this.workspaces.revokeInvitation(ctx, id);
  }
}

const tokenParam = z.string().min(20).max(200);

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Public()
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.workspaces.previewInvitation(tokenParam.parse(token));
  }

  @Post(':token/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.workspaces.acceptInvitation(user, tokenParam.parse(token));
  }
}
