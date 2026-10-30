'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createWorkspaceSchema, type MembershipSummary } from '@crm/shared';
import type { z } from 'zod';
import { Logo } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { ME_KEY, useMe } from '@/hooks/use-auth';

type Values = z.infer<typeof createWorkspaceSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const client = useQueryClient();
  const me = useMe();
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(createWorkspaceSchema), defaultValues: { name: '' } });
  const create = useMutation({
    mutationFn: (values: Values) => api<MembershipSummary>('/workspaces', { method: 'POST', body: values }),
    onSuccess: async (membership) => {
      await client.invalidateQueries({ queryKey: ME_KEY });
      router.push(`/w/${membership.workspace.slug}/dashboard`);
    },
  });

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 px-4">
      <Logo className="mb-8" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Create a workspace</CardTitle>
          <CardDescription>A workspace holds your team, customers and pipeline. You can create several and switch at any time.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
            <Field label="Workspace name" htmlFor="name" error={formState.errors.name?.message}>
              <Input placeholder="Acme Inc." {...fieldA11y('name', formState.errors.name?.message)} {...register('name')} />
            </Field>
            <Button type="submit" className="w-full" loading={create.isPending}>
              Create workspace
            </Button>
          </form>
          {me.data && me.data.memberships.length > 0 && (
            <Button variant="link" asChild className="mt-3 w-full">
              <Link href="/app">Back to my workspaces</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
