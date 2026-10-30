'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MailOpen } from 'lucide-react';
import { humanize, type InvitationPreview } from '@crm/shared';
import { AuthLayout } from '@/components/auth-layout';
import { ErrorState, FullPageLoader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { ME_KEY, useMe } from '@/hooks/use-auth';
import { formatDate } from '@/lib/format';

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const preview = useQuery({ queryKey: ['invitation', token], queryFn: () => api<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`) });
  const me = useMe();
  const signedIn = me.isSuccess;
  const accept = useMutation({
    mutationFn: () => api<{ workspace: { slug: string } }>(`/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ME_KEY });
      router.replace(`/w/${result.workspace.slug}/dashboard`);
    },
  });

  // A 401 from /auth/me simply means "not signed in" here.
  if (preview.isPending || me.isPending) return <FullPageLoader label="Loading invitation…" />;

  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <AuthLayout title="Workspace invitation">
      {preview.isError ? (
        <ErrorState error={preview.error} />
      ) : preview.data ? (
        <div className="space-y-5">
          <div className="rounded-lg border bg-card p-4">
            <MailOpen className="mb-3 h-6 w-6 text-primary" />
            <p className="text-sm">
              {preview.data.invitedBy ?? 'A teammate'} invited <strong>{preview.data.email}</strong> to join <strong>{preview.data.workspaceName}</strong> as{' '}
              <strong>{humanize(preview.data.role)}</strong>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Expires {formatDate(preview.data.expiresAt)}</p>
          </div>
          {signedIn ? (
            me.data.email.toLowerCase() === preview.data.email.toLowerCase() ? (
              <Button className="w-full" loading={accept.isPending} onClick={() => accept.mutate()}>
                Accept invitation
              </Button>
            ) : (
              <p role="alert" className="text-sm text-destructive">
                You are signed in as {me.data.email}. Sign out and sign in as {preview.data.email} to accept this invitation.
              </p>
            )
          ) : (
            <div className="grid gap-2">
              <Button asChild>
                <Link href={`/register?email=${encodeURIComponent(preview.data.email)}&next=${next}`}>Create an account to accept</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/login?email=${encodeURIComponent(preview.data.email)}&next=${next}`}>I already have an account</Link>
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </AuthLayout>
  );
}
