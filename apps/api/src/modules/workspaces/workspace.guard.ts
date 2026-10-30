import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PLAN_DEFINITIONS, ROLE_PERMISSIONS, type Permission, type PlanFeature } from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { clientIp, FEATURE_KEY, PERMISSIONS_KEY } from '../../common/decorators';
import { AppException } from '../../common/errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tenant isolation guard for every route under /workspaces/:workspaceId.
 *  1. Verifies the authenticated user is a member of the workspace (404 otherwise, so the
 *     existence of other tenants is never revealed).
 *  2. Enforces role permissions declared with @RequirePermissions.
 *  3. Enforces plan features declared with @RequireFeature.
 * The resolved context is attached to the request and consumed by services, which always
 * filter by context.workspaceId.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) throw AppException.unauthorized();

    const workspaceId = request.params.workspaceId;
    if (typeof workspaceId !== 'string' || !UUID.test(workspaceId)) throw AppException.notFound('Workspace');

    const membership = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      include: { workspace: { select: { id: true, slug: true, plan: true, currency: true } } },
    });
    if (!membership) throw AppException.notFound('Workspace');

    const permissions = ROLE_PERMISSIONS[membership.role];
    const required =
      this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (required.some((permission) => !permissions.includes(permission))) throw AppException.forbidden();

    const features = PLAN_DEFINITIONS[membership.workspace.plan].features;
    const feature = this.reflector.getAllAndOverride<PlanFeature | undefined>(FEATURE_KEY, [context.getHandler(), context.getClass()]);
    if (feature && !features.includes(feature)) throw AppException.planFeature(feature);

    request.workspace = {
      workspaceId: membership.workspace.id,
      workspaceSlug: membership.workspace.slug,
      userId: user.id,
      role: membership.role,
      plan: membership.workspace.plan,
      currency: membership.workspace.currency,
      permissions,
      features,
      ipAddress: clientIp(request),
    };
    return true;
  }
}
