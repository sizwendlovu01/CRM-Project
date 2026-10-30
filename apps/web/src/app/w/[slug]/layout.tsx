'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ErrorState, FullPageLoader, Logo } from '@/components/common';
import { Button } from '@/components/ui/button';
import { useWorkspaceState, WorkspaceProvider } from '@/hooks/use-workspace';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const state = useWorkspaceState(slug);

  if (state.status === 'loading') return <FullPageLoader label="Loading workspace…" />;
  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-md py-24">
        <ErrorState error={state.error} onRetry={state.retry} />
      </div>
    );
  }
  if (state.status === 'not-found') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <Logo />
        <h1 className="text-xl font-semibold">Workspace not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">This workspace does not exist or you do not have access to it.</p>
        <Button asChild>
          <Link href="/app">Go to my workspaces</Link>
        </Button>
      </div>
    );
  }
  return (
    <WorkspaceProvider value={state.value}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
