import { canModifyRecord, hasPermission } from '@crm/shared';
import { AppException } from './errors';
import type { WorkspaceContext } from './types';

/** Throws 403 unless the caller may modify the record (role + ownership rules). */
export function assertCanModify(ctx: WorkspaceContext, record: { assignedToId?: string | null; createdById?: string | null }): void {
  if (!canModifyRecord(ctx.role, ctx.userId, record)) {
    throw AppException.forbidden('You can only modify records that are assigned to you.');
  }
}

/**
 * Resolves the assignee for a new record. Users without `records:assign` can only assign to
 * themselves; omitted assignees default to the creator.
 */
export function resolveAssigneeForCreate(ctx: WorkspaceContext, requested: string | null | undefined): string | null {
  if (!hasPermission(ctx.role, 'records:assign')) {
    if (requested && requested !== ctx.userId) {
      throw AppException.forbidden('You do not have permission to assign records to other members.');
    }
    return ctx.userId;
  }
  return requested === undefined ? ctx.userId : requested;
}

/** Validates an assignee change on update. Returns true when the assignee actually changes. */
export function assertAssigneeChange(
  ctx: WorkspaceContext,
  current: string | null,
  requested: string | null | undefined,
): boolean {
  if (requested === undefined || requested === current) return false;
  if (!hasPermission(ctx.role, 'records:assign')) {
    throw AppException.forbidden('You do not have permission to reassign records.');
  }
  return true;
}
