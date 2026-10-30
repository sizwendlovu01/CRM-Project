'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { MotionConfig } from 'motion/react';
import { toast, Toaster } from 'sonner';
import { ApiError, UNAUTHORIZED_EVENT } from '@/lib/api';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean };
  }
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache({
      // Every failed mutation surfaces a readable message unless the caller handles it.
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silent) return;
        toast.error(error instanceof Error ? error.message : 'Something went wrong.');
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => {
          if (error instanceof ApiError && error.status > 0 && error.status < 500) return false;
          return count < 2;
        },
      },
    },
  });
}

/** Redirects to sign-in whenever the API reports an expired session. */
function SessionWatcher({ client }: { client: QueryClient }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const handler = () => {
      if (!/^\/(w|app|onboarding)(\/|$)/.test(pathname)) return;
      client.clear();
      toast.info('Your session has ended. Please sign in again.');
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, [client, pathname, router]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        {/* Honour the OS "reduce motion" setting for every motion component. */}
        <MotionConfig reducedMotion="user">
          <SessionWatcher client={client} />
          {children}
          <Toaster richColors closeButton position="bottom-right" toastOptions={{ classNames: { toast: 'rounded-xl! shadow-lg!' } }} />
        </MotionConfig>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
