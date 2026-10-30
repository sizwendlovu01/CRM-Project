'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CurrentUser, Member, Permission, PlanFeature, WorkspaceDetail } from '@crm/shared';
import { api } from '@/lib/api';
import { LAST_WORKSPACE_KEY, useMe } from './use-auth';

export interface WorkspaceContextValue {
  me: CurrentUser;
  workspace: WorkspaceDetail;
  workspaceId: string;
  slug: string;
  members: Member[];
  /** API path prefix: /workspaces/:id */
  base: string;
  /** App URL builder: /w/:slug + path */
  href: (path: string) => string;
  can: (permission: Permission) => boolean;
  hasFeature: (feature: PlanFeature) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function wsKey(workspaceId: string, ...parts: unknown[]) {
  return ['ws', workspaceId, ...parts] as const;
}

export type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'not-found' }
  | { status: 'ready'; value: WorkspaceContextValue };

/** Resolves the workspace for a URL slug from the user's memberships (server re-checks access). */
export function useWorkspaceState(slug: string): WorkspaceState {
  const me = useMe();
  const membership = me.data?.memberships.find((m) => m.workspace.slug === slug);
  const workspaceId = membership?.workspace.id;

  const detail = useQuery({
    queryKey: wsKey(workspaceId ?? '-', 'detail'),
    queryFn: () => api<WorkspaceDetail>(`/workspaces/${workspaceId}`),
    enabled: Boolean(workspaceId),
  });
  const members = useQuery({
    queryKey: wsKey(workspaceId ?? '-', 'members'),
    queryFn: () => api<Member[]>(`/workspaces/${workspaceId}/members`),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (workspaceId) {
      try {
        localStorage.setItem(LAST_WORKSPACE_KEY, slug);
      } catch {
        /* storage unavailable */
      }
    }
  }, [workspaceId, slug]);

  const value = useMemo<WorkspaceContextValue | null>(() => {
    if (!me.data || !detail.data || !workspaceId) return null;
    const ws = detail.data;
    return {
      me: me.data,
      workspace: ws,
      workspaceId,
      slug,
      members: members.data ?? [],
      base: `/workspaces/${workspaceId}`,
      href: (path: string) => `/w/${slug}${path}`,
      can: (permission) => ws.permissions.includes(permission),
      hasFeature: (feature) => ws.features.includes(feature),
    };
  }, [me.data, detail.data, members.data, workspaceId, slug]);

  if (me.isError) return { status: 'error', error: me.error, retry: () => void me.refetch() };
  if (me.isPending) return { status: 'loading' };
  if (!membership) return { status: 'not-found' };
  if (detail.isError) return { status: 'error', error: detail.error, retry: () => void detail.refetch() };
  if (!value) return { status: 'loading' };
  return { status: 'ready', value };
}

export function WorkspaceProvider({ value, children }: { value: WorkspaceContextValue; children: React.ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside a workspace route');
  return ctx;
}
