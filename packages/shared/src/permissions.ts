import type { Role } from './enums';

export const PERMISSIONS = [
  'workspace:read',
  'workspace:update',
  'workspace:delete',
  'members:read',
  'members:invite',
  'members:manage',
  'billing:read',
  'billing:manage',
  'records:read',
  'records:create',
  'records:update_own',
  'records:update_any',
  'records:delete_any',
  'records:assign',
  'records:import',
  'records:export',
  'pipelines:manage',
  'analytics:view',
  'analytics:team',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((p) => p !== 'workspace:delete' && p !== 'billing:manage'),
  MANAGER: [
    'workspace:read',
    'members:read',
    'billing:read',
    'records:read',
    'records:create',
    'records:update_own',
    'records:update_any',
    'records:delete_any',
    'records:assign',
    'records:import',
    'records:export',
    'pipelines:manage',
    'analytics:view',
    'analytics:team',
  ],
  SALES_REPRESENTATIVE: [
    'workspace:read',
    'members:read',
    'records:read',
    'records:create',
    'records:update_own',
    'analytics:view',
  ],
  VIEWER: ['workspace:read', 'members:read', 'records:read', 'analytics:view'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_RANK: Record<Role, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  SALES_REPRESENTATIVE: 2,
  VIEWER: 1,
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: 'Full control including billing, ownership and workspace deletion.',
  ADMIN: 'Manages members, settings, pipelines and every record.',
  MANAGER: 'Manages the sales team, assignments, imports and performance.',
  SALES_REPRESENTATIVE: 'Creates records and manages the records assigned to them.',
  VIEWER: 'Read-only access to workspace records and dashboards.',
};

/**
 * Whether an actor may change a member from `currentRole` to `nextRole`.
 * Ownership transfer is a separate, owner-only operation and is never allowed here.
 */
export function canChangeRole(actor: Role, currentRole: Role, nextRole: Role): boolean {
  if (!hasPermission(actor, 'members:manage')) return false;
  if (currentRole === 'OWNER' || nextRole === 'OWNER') return false;
  return ROLE_RANK[actor] > ROLE_RANK[currentRole] && ROLE_RANK[actor] > ROLE_RANK[nextRole];
}

/** Whether an actor may remove a member that currently holds `targetRole`. */
export function canRemoveMember(actor: Role, targetRole: Role): boolean {
  if (!hasPermission(actor, 'members:manage')) return false;
  if (targetRole === 'OWNER') return false;
  return ROLE_RANK[actor] > ROLE_RANK[targetRole];
}

/** Whether an actor may invite someone with the given role. */
export function canInviteRole(actor: Role, role: Role): boolean {
  if (!hasPermission(actor, 'members:invite')) return false;
  if (role === 'OWNER') return false;
  return ROLE_RANK[actor] > ROLE_RANK[role];
}

/**
 * Record-level write check. Users with `records:update_any` may edit everything;
 * everyone else may only edit records assigned to or created by them.
 */
export function canModifyRecord(
  role: Role,
  userId: string,
  record: { assignedToId?: string | null; createdById?: string | null },
): boolean {
  if (hasPermission(role, 'records:update_any')) return true;
  if (!hasPermission(role, 'records:update_own')) return false;
  return record.assignedToId === userId || record.createdById === userId;
}
