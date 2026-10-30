import type { Permission, Plan, PlanFeature, Role } from '@crm/shared';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  sessionId: string;
}

/** Resolved tenant context for workspace-scoped requests. Built by WorkspaceGuard. */
export interface WorkspaceContext {
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
  role: Role;
  plan: Plan;
  currency: string;
  permissions: readonly Permission[];
  features: readonly PlanFeature[];
  ipAddress: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      workspace?: WorkspaceContext;
      sessionToken?: string;
    }
  }
}
