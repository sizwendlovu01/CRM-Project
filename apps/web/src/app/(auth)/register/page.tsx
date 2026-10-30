'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { registerSchema, type CurrentUser, type RegisterInput } from '@crm/shared';
import { AuthLayout } from '@/components/auth-layout';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input } from '@/components/ui/input';
import { api, ApiError, errorMessage } from '@/lib/api';
import { ME_KEY, safeNext } from '@/hooks/use-auth';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: params.get('email') ?? '', password: '', workspaceName: '' },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await api<CurrentUser>('/auth/register', { method: 'POST', body: values });
      client.setQueryData(ME_KEY, user);
      const next = params.get('next');
      router.replace(next ? safeNext(next) : `/w/${user.memberships[0]?.workspace.slug}/dashboard`);
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [path, message] of Object.entries(error.fieldErrors())) {
          if (path in values) setError(path as keyof RegisterInput, { message });
        }
      }
      setFormError(errorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-danger-soft px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}
      <Field label="Full name" htmlFor="name" error={errors.name?.message} required>
        <Input autoComplete="name" {...fieldA11y('name', errors.name?.message)} {...register('name')} />
      </Field>
      <Field label="Work email" htmlFor="email" error={errors.email?.message} required>
        <Input type="email" autoComplete="email" {...fieldA11y('email', errors.email?.message)} {...register('email')} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 10 characters with a letter and a number." required>
        <Input type="password" autoComplete="new-password" {...fieldA11y('password', errors.password?.message)} {...register('password')} />
      </Field>
      <Field label="Company / workspace name" htmlFor="workspaceName" error={errors.workspaceName?.message} required>
        <Input autoComplete="organization" {...fieldA11y('workspaceName', errors.workspaceName?.message)} {...register('workspaceName')} />
      </Field>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Create account
      </Button>
      <p className="text-center text-xs text-muted-foreground">You start on the Free plan. No payment details are required.</p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Set up your CRM in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthLayout>
  );
}
