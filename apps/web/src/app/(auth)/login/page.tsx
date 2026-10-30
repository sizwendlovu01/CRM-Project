'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { loginSchema, type CurrentUser, type LoginInput } from '@crm/shared';
import { AuthLayout } from '@/components/auth-layout';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { ME_KEY, safeNext } from '@/hooks/use-auth';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: params.get('email') ?? '', password: '' } });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await api<CurrentUser>('/auth/login', { method: 'POST', body: values });
      client.setQueryData(ME_KEY, user);
      router.replace(safeNext(params.get('next')));
    } catch (error) {
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
      <Field label="Work email" htmlFor="email" error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...fieldA11y('email', errors.email?.message)} {...register('email')} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...fieldA11y('password', errors.password?.message)} {...register('password')} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your workspace."
      footer={
        <>
          New here?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
