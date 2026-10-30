'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { passwordSchema } from '@crm/shared';
import { AuthLayout } from '@/components/auth-layout';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type Values = z.infer<typeof schema>;

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  if (!token) {
    return (
      <p role="alert" className="text-sm text-destructive">
        This reset link is missing its token. <Link href="/forgot-password" className="font-medium underline">Request a new link</Link>.
      </p>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password: values.password } });
      toast.success('Password updated. Please sign in with your new password.');
      router.replace('/login');
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-danger-soft px-3 py-2 text-sm text-destructive">
          {formError} <Link href="/forgot-password" className="font-medium underline">Request a new link</Link>
        </div>
      )}
      <Field label="New password" htmlFor="password" error={formState.errors.password?.message} hint="At least 10 characters with a letter and a number.">
        <Input type="password" autoComplete="new-password" {...fieldA11y('password', formState.errors.password?.message)} {...register('password')} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={formState.errors.confirm?.message}>
        <Input type="password" autoComplete="new-password" {...fieldA11y('confirm', formState.errors.confirm?.message)} {...register('confirm')} />
      </Field>
      <Button type="submit" className="w-full" loading={formState.isSubmitting}>
        Update password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" subtitle="For your security, all existing sessions will be signed out.">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
