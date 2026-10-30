'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { CurrentUser } from '@crm/shared';
import { api } from '@/lib/api';

export const ME_KEY = ['me'] as const;
export const LAST_WORKSPACE_KEY = 'crm:lastWorkspace';

export function useMe(enabled = true) {
  return useQuery({ queryKey: ME_KEY, queryFn: () => api<CurrentUser>('/auth/me'), staleTime: 60_000, enabled });
}

export function useLogout() {
  const client = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      client.clear();
      router.replace('/login');
    },
  });
}

/** Safe post-login redirect target: only same-site relative paths are honoured. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/app';
  return next;
}
