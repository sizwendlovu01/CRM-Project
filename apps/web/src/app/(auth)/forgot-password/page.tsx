'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { forgotPasswordSchema } from '@crm/shared';
import type { z } from 'zod';
import { AuthLayout } from '@/components/auth-layout';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';

type Values = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: values });
      setSentTo(values.email);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a secure link to choose a new password."
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sentTo ? (
        <div role="status" className="rounded-lg border bg-success-soft p-4 text-sm text-success">
          <MailCheck className="mb-2 h-5 w-5" />
          If an account exists for <strong>{sentTo}</strong>, a password reset link is on its way. The link expires in 60 minutes.
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-danger-soft px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
            <Input type="email" autoComplete="email" {...fieldA11y('email', formState.errors.email?.message)} {...register('email')} />
          </Field>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
