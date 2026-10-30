'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AuthLayout } from '@/components/auth-layout';
import { FullPageLoader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';
import { ME_KEY } from '@/hooks/use-auth';

function Verify() {
  const token = useSearchParams().get('token');
  const client = useQueryClient();
  const [state, setState] = useState<{ status: 'pending' | 'ok' | 'error'; message?: string }>({ status: 'pending' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState({ status: 'error', message: 'This verification link is missing its token.' });
      return;
    }
    api('/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => {
        setState({ status: 'ok' });
        void client.invalidateQueries({ queryKey: ME_KEY });
      })
      .catch((error: unknown) => setState({ status: 'error', message: errorMessage(error) }));
  }, [token, client]);

  if (state.status === 'pending') return <FullPageLoader label="Verifying your email…" />;
  return (
    <div className="space-y-5 text-center">
      {state.status === 'ok' ? (
        <>
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <p className="text-sm text-muted-foreground">Your email address is verified. Thank you!</p>
        </>
      ) : (
        <>
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <p role="alert" className="text-sm text-muted-foreground">{state.message}</p>
        </>
      )}
      <Button asChild className="w-full">
        <Link href="/app">Continue to the app</Link>
      </Button>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout title="Email verification">
      <Suspense>
        <Verify />
      </Suspense>
    </AuthLayout>
  );
}
