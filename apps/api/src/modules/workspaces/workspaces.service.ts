import { Inject, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import {
  canChangeRole,
  canInviteRole,
  canRemoveMember,
  humanize,
  PLAN_DEFINITIONS,
  ROLE_PERMISSIONS,
  type InvitationDto,
  type InvitationPreview,
  type Member,
  type WorkspaceDetail,
} from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { AppException } from '../../common/errors';
import { generateToken, hashToken } from '../../common/crypto';
import type { AuthUser, WorkspaceContext } from '../../common/types';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/mail.templates';
import { AuditService } from '../audit-logs/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanLimitsService } from '../subscriptions/plan-limits.service';
import { INVITATION_TTL_DAYS } from '../auth/auth.constants';
import { createWorkspaceWithDefaults } from './workspace-factory';

const MAX_OWNED_WORKSPACES = 10;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly limits: PlanLimitsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /* ---------------------------- Workspaces ---------------------------- */

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { workspace: { select: { id: true, name: true, slug: true, plan: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ role: m.role, workspace: m.workspace }));
  }

  async create(user: AuthUser, name: string) {
    const owned = await this.prisma.workspace.count({ where: { ownerId: user.id } });
    if (owned >= MAX_OWNED_WORKSPACES) {
      throw AppException.badRequest('WORKSPACE_LIMIT', `You can own at most ${MAX_OWNED_WORKSPACES} workspaces.`);
    }
    const workspace = await this.prisma.$transaction((tx) => createWorkspaceWithDefaults(tx, user.id, name));
    await this.audit.log({ workspaceId: workspace.id, userId: user.id, ipAddress: null }, {
      action: 'workspace.created',
      entityType: 'workspace',
      entityId: workspace.id,
    });
    return { role: 'OWNER' as const, workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, plan: workspace.plan } };
  }

  async detail(ctx: WorkspaceContext): Promise<WorkspaceDetail> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } });
    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      plan: ws.plan,
      subscriptionStatus: ws.subscriptionStatus,
      currentPeriodEnd: ws.currentPeriodEnd?.toISOString() ?? null,
      industry: ws.industry,
      timezone: ws.timezone,
      currency: ws.currency,
      createdAt: ws.createdAt.toISOString(),
      role: ctx.role,
      permissions: [...ROLE_PERMISSIONS[ctx.role]],
      features: [...PLAN_DEFINITIONS[ws.plan].features],
    };
  }

  async update(ctx: WorkspaceContext, input: { name: string; industry?: string | null; timezone: string; currency: string }) {
    await this.prisma.workspace.update({
      where: { id: ctx.workspaceId },
      data: { name: input.name, industry: input.industry ?? null, timezone: input.timezone, currency: input.currency },
    });
    await this.audit.log(ctx, { action: 'workspace.updated', entityType: 'workspace', entityId: ctx.workspaceId, metadata: { ...input } });
    return this.detail(ctx);
  }

  async remove(ctx: WorkspaceContext, confirmName: string): Promise<void> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } });
    if (confirmName.trim() !== ws.name) {
      throw AppException.badRequest('CONFIRMATION_MISMATCH', 'Type the workspace name exactly to confirm deletion.', [
        { path: 'confirmName', message: 'Does not match the workspace name' },
      ]);
    }
    await this.prisma.workspace.delete({ where: { id: ctx.workspaceId } });
  }

  /* ------------------------------ Members ------------------------------ */

  async members(ctx: WorkspaceContext): Promise<Member[]> {
    const rows = await this.prisma.membership.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, name: true, email: true, jobTitle: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({ id: m.id, role: m.role, joinedAt: m.createdAt.toISOString(), user: m.user }));
  }

  private async findMember(ctx: WorkspaceContext, memberId: string) {
    const member = await this.prisma.membership.findFirst({
      where: { id: memberId, workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!member) throw AppException.notFound('Member');
    return member;
  }

  async changeRole(ctx: WorkspaceContext, memberId: string, role: Role): Promise<Member[]> {
    const member = await this.findMember(ctx, memberId);
    if (member.userId === ctx.userId) throw AppException.forbidden('You cannot change your own role.');
    if (!canChangeRole(ctx.role, member.role, role)) {
      throw AppException.forbidden('You cannot assign this role to this member.');
    }
    await this.prisma.membership.update({ where: { id: member.id }, data: { role } });
    await this.audit.log(ctx, {
      action: 'member.role_changed',
      entityType: 'membership',
      entityId: member.id,
      metadata: { userId: member.userId, from: member.role, to: role },
    });
    return this.members(ctx);
  }

  async removeMember(ctx: WorkspaceContext, memberId: string): Promise<void> {
    const member = await this.findMember(ctx, memberId);
    if (member.userId === ctx.userId) throw AppException.forbidden('Use "Leave workspace" to remove yourself.');
    if (!canRemoveMember(ctx.role, member.role)) throw AppException.forbidden('You cannot remove this member.');
    await this.detachMember(ctx.workspaceId, member.id, member.userId);
    await this.audit.log(ctx, {
      action: 'member.removed',
      entityType: 'membership',
      entityId: member.id,
      metadata: { userId: member.userId, email: member.user.email, role: member.role },
    });
  }

  async leave(ctx: WorkspaceContext): Promise<void> {
    if (ctx.role === 'OWNER') {
      throw AppException.badRequest('OWNER_CANNOT_LEAVE', 'Transfer ownership to another member before leaving this workspace.');
    }
    const member = await this.prisma.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: ctx.userId } },
    });
    await this.detachMember(ctx.workspaceId, member.id, ctx.userId);
    await this.audit.log(ctx, { action: 'member.left', entityType: 'membership', entityId: member.id });
  }

  /** Removes a membership and unassigns the member's open work so nothing is orphaned. */
  private async detachMember(workspaceId: string, membershipId: string, userId: string): Promise<void> {
    const where = { workspaceId, assignedToId: userId };
    await this.prisma.$transaction([
      this.prisma.membership.delete({ where: { id: membershipId } }),
      this.prisma.customer.updateMany({ where, data: { assignedToId: null } }),
      this.prisma.lead.updateMany({ where, data: { assignedToId: null } }),
      this.prisma.deal.updateMany({ where, data: { assignedToId: null } }),
      this.prisma.task.updateMany({ where, data: { assignedToId: null } }),
    ]);
  }

  async transferOwnership(ctx: WorkspaceContext, userId: string): Promise<Member[]> {
    if (ctx.role !== 'OWNER') throw AppException.forbidden('Only the owner can transfer ownership.');
    if (userId === ctx.userId) throw AppException.badRequest('INVALID_TARGET', 'You already own this workspace.');
    const target = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId } },
    });
    if (!target) throw AppException.invalidReference('userId', 'User is not a member of this workspace');
    await this.prisma.$transaction([
      this.prisma.membership.update({ where: { id: target.id }, data: { role: 'OWNER' } }),
      this.prisma.membership.update({
        where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: ctx.userId } },
        data: { role: 'ADMIN' },
      }),
      this.prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { ownerId: userId } }),
    ]);
    await this.audit.log(ctx, { action: 'workspace.ownership_transferred', entityType: 'workspace', entityId: ctx.workspaceId, metadata: { to: userId } });
    return this.members({ ...ctx, role: 'ADMIN' });
  }

  /* ---------------------------- Invitations ---------------------------- */

  async invitations(ctx: WorkspaceContext): Promise<InvitationDto[]> {
    const rows = await this.prisma.invitation.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { invitedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(toInvitationDto);
  }

  async invite(ctx: WorkspaceContext, inviter: AuthUser, email: string, role: Role): Promise<InvitationDto> {
    if (!canInviteRole(ctx.role, role)) throw AppException.forbidden('You cannot invite members with this role.');

    const existingMember = await this.prisma.membership.findFirst({
      where: { workspaceId: ctx.workspaceId, user: { email } },
      select: { id: true },
    });
    if (existingMember) {
      throw AppException.conflict('ALREADY_MEMBER', 'This person is already a member of the workspace.', [
        { path: 'email', message: 'Already a member' },
      ]);
    }

    // Replace any previous pending invitation for the same email (also frees its seat).
    await this.prisma.invitation.updateMany({
      where: { workspaceId: ctx.workspaceId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.limits.assertWithinLimit(ctx.workspaceId, ctx.plan, 'members');

    const token = generateToken();
    const invitation = await this.prisma.invitation.create({
      data: {
        workspaceId: ctx.workspaceId,
        email,
        role,
        tokenHash: hashToken(token, this.env.SESSION_SECRET),
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000),
      },
      include: { invitedBy: { select: { id: true, name: true, email: true } }, workspace: { select: { name: true } } },
    });

    await this.sendInvitationEmail(invitation.workspace.name, inviter.name, role, email, token);

    const invitee = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (invitee) {
      await this.notifications.notify({
        userId: invitee.id,
        workspaceId: null,
        type: 'WORKSPACE_INVITATION',
        title: `${inviter.name} invited you to ${invitation.workspace.name}`,
        body: `Role: ${humanize(role)}`,
        link: `/invite/${token}`,
        actorId: inviter.id,
      });
    }

    await this.audit.log(ctx, { action: 'member.invited', entityType: 'invitation', entityId: invitation.id, metadata: { email, role } });
    return toInvitationDto(invitation);
  }

  async resendInvitation(ctx: WorkspaceContext, inviter: AuthUser, invitationId: string): Promise<InvitationDto> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, workspaceId: ctx.workspaceId, acceptedAt: null, revokedAt: null },
      include: { workspace: { select: { name: true } }, invitedBy: { select: { id: true, name: true, email: true } } },
    });
    if (!invitation) throw AppException.notFound('Invitation');
    if (!canInviteRole(ctx.role, invitation.role)) throw AppException.forbidden();
    const token = generateToken();
    const updated = await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { tokenHash: hashToken(token, this.env.SESSION_SECRET), expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000) },
      include: { invitedBy: { select: { id: true, name: true, email: true } } },
    });
    await this.sendInvitationEmail(invitation.workspace.name, inviter.name, invitation.role, invitation.email, token);
    return toInvitationDto(updated);
  }

  async revokeInvitation(ctx: WorkspaceContext, invitationId: string): Promise<void> {
    const result = await this.prisma.invitation.updateMany({
      where: { id: invitationId, workspaceId: ctx.workspaceId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw AppException.notFound('Invitation');
    await this.audit.log(ctx, { action: 'member.invitation_revoked', entityType: 'invitation', entityId: invitationId });
  }

  private async sendInvitationEmail(workspaceName: string, inviterName: string, role: Role, email: string, token: string) {
    const url = `${this.env.APP_URL}/invite/${encodeURIComponent(token)}`;
    await this.mail.send({ to: email, ...templates.invitation(workspaceName, inviterName, humanize(role), url) });
  }

  private async findValidInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token, this.env.SESSION_SECRET) },
      include: { workspace: { select: { id: true, name: true, slug: true, plan: true } }, invitedBy: { select: { id: true, name: true } } },
    });
    if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt.getTime() <= Date.now()) {
      throw AppException.badRequest('INVALID_INVITATION', 'This invitation is invalid, expired or has already been used.');
    }
    return invitation;
  }

  async previewInvitation(token: string): Promise<InvitationPreview> {
    const invitation = await this.findValidInvitation(token);
    return {
      workspaceName: invitation.workspace.name,
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invitedBy?.name ?? null,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async acceptInvitation(user: AuthUser, token: string) {
    const invitation = await this.findValidInvitation(token);
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw AppException.forbidden(`This invitation was sent to ${invitation.email}. Sign in with that account to accept it.`);
    }

    const alreadyMember = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
    });

    if (!alreadyMember) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.invitation.updateMany({
            where: { id: invitation.id, acceptedAt: null, revokedAt: null },
            data: { acceptedAt: new Date() },
          });
          if (claimed.count !== 1) throw AppException.badRequest('INVALID_INVITATION', 'This invitation has already been used.');
          await tx.membership.create({ data: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role } });
          // Accepting a link delivered to this address proves ownership of the email.
          await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          // Concurrent accept: membership already exists.
        } else {
          throw error;
        }
      }

      if (invitation.invitedById) {
        await this.notifications.notify({
          userId: invitation.invitedById,
          workspaceId: invitation.workspaceId,
          type: 'MEMBER_JOINED',
          title: `${user.name} joined ${invitation.workspace.name}`,
          link: `/w/${invitation.workspace.slug}/settings/team`,
          actorId: user.id,
        });
      }
      await this.audit.log({ workspaceId: invitation.workspaceId, userId: user.id, ipAddress: null }, {
        action: 'member.joined',
        entityType: 'membership',
        metadata: { role: invitation.role },
      });
    }

    return { workspace: { id: invitation.workspace.id, name: invitation.workspace.name, slug: invitation.workspace.slug } };
  }
}

function toInvitationDto(row: {
  id: string;
  email: string;
  role: Role;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  invitedBy: { id: string; name: string; email: string } | null;
}): InvitationDto {
  const status = row.acceptedAt ? 'ACCEPTED' : row.revokedAt ? 'REVOKED' : row.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : 'PENDING';
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    invitedBy: row.invitedBy,
  };
}
