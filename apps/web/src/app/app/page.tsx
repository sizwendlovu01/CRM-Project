'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState, FullPageLoader } from '@/components/common';
import { LAST_WORKSPACE_KEY, useMe } from '@/hooks/use-auth';

/** Entry point after sign-in: opens the last used workspace, or onboarding when there is none. */
export default function AppEntry() {
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (!me.data) return;
    const memberships = me.data.memberships;
    if (memberships.length === 0) {
      router.replace('/onboarding');
      return;
    }
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_WORKSPACE_KEY);
    } catch {
      /* storage unavailable */
    }
    const target = memberships.find((m) => m.workspace.slug === last) ?? memberships[0]!;
    router.replace(`/w/${target.workspace.slug}/dashboard`);
  }, [me.data, router]);

  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} className="min-h-[60vh]" />;
  return <FullPageLoader label="Opening your workspace…" />;
}
