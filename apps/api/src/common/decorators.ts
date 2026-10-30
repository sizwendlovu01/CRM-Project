import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Permission, PlanFeature } from '@crm/shared';
import type { AuthUser, WorkspaceContext } from './types';
import { AppException } from './errors';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as accessible without a session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'requiredPermissions';
/** Requires every listed workspace permission (checked by WorkspaceGuard). */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const FEATURE_KEY = 'requiredFeature';
/** Requires the workspace plan to include a feature (checked by WorkspaceGuard). */
export const RequireFeature = (feature: PlanFeature) => SetMetadata(FEATURE_KEY, feature);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<Request>();
  if (!request.user) throw AppException.unauthorized();
  return request.user;
});

export const Workspace = createParamDecorator((_data: unknown, ctx: ExecutionContext): WorkspaceContext => {
  const request = ctx.switchToHttp().getRequest<Request>();
  if (!request.workspace) throw AppException.forbidden('Workspace context missing');
  return request.workspace;
});

export function clientIp(request: Request): string | null {
  return request.ip ?? request.socket?.remoteAddress ?? null;
}
