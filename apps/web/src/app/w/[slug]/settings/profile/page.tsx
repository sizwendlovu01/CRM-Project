'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { passwordSchema, updateProfileSchema, type CurrentUser, type SessionInfo } from '@crm/shared';
import { ErrorState, TableSkeleton } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input, Select } from '@/components/ui/input';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { ME_KEY } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';

type ProfileInput = z.input<typeof updateProfileSchema>;
type ProfileOutput = z.output<typeof updateProfileSchema>;

const passwordForm = z
  .object({ currentPassword: z.string().min(1, 'Current password is required'), newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type PasswordValues = z.infer<typeof passwordForm>;

const TIMEZONES = ['UTC', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney'];

function describeAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

export default function ProfileSettingsPage() {
  const { me } = useWorkspace();
  const client = useQueryClient();

  const profile = useForm<ProfileInput, unknown, ProfileOutput>({
    resolver: zodResolver(updateProfileSchema),
    values: { name: me.name, jobTitle: me.jobTitle ?? '', phone: me.phone ?? '', timezone: me.timezone },
  });
  const saveProfile = useMutation({
    mutationFn: (values: ProfileOutput) => api<CurrentUser>('/users/me', { method: 'PATCH', body: values }),
    onSuccess: (user) => {
      client.setQueryData(ME_KEY, user);
      void client.invalidateQueries({ queryKey: ['ws'] });
      toast.success('Profile updated');
    },
  });

  const password = useForm<PasswordValues>({ resolver: zodResolver(passwordForm), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const changePassword = useMutation({
    mutationFn: (values: PasswordValues) => api('/users/me/password', { method: 'POST', body: { currentPassword: values.currentPassword, newPassword: values.newPassword } }),
    meta: { silent: true },
    onSuccess: () => {
      password.reset();
      toast.success('Password changed. Other sessions were signed out.');
      void client.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const fields = error.fieldErrors();
        if (fields.currentPassword) password.setError('currentPassword', { message: fields.currentPassword });
        if (fields.newPassword) password.setError('newPassword', { message: fields.newPassword });
      }
      toast.error(error.message);
    },
  });

  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api<SessionInfo[]>('/users/me/sessions') });
  const revoke = useMutation({ mutationFn: (id: string) => api(`/users/me/sessions/${id}`, { method: 'DELETE' }), onSuccess: () => void sessions.refetch() });
  const revokeOthers = useMutation({ mutationFn: () => api('/users/me/sessions/revoke-others', { method: 'POST' }), onSuccess: () => { toast.success('Other sessions signed out'); void sessions.refetch(); } });

  const pe = profile.formState.errors;
  const we = password.formState.errors;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>{me.email}{me.emailVerified ? '' : ' · not verified'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={profile.handleSubmit((v) => saveProfile.mutate(v))} className="space-y-4">
            <Field label="Full name" htmlFor="p-name" error={pe.name?.message} required>
              <Input {...fieldA11y('p-name', pe.name?.message)} {...profile.register('name')} />
            </Field>
            <Field label="Job title" htmlFor="p-title" error={pe.jobTitle?.message}>
              <Input {...fieldA11y('p-title', pe.jobTitle?.message)} {...profile.register('jobTitle')} />
            </Field>
            <Field label="Phone" htmlFor="p-phone" error={pe.phone?.message}>
              <Input type="tel" {...fieldA11y('p-phone', pe.phone?.message)} {...profile.register('phone')} />
            </Field>
            <Field label="Timezone" htmlFor="p-timezone">
              <Select id="p-timezone" {...profile.register('timezone')}>
                {[...new Set([me.timezone, ...TIMEZONES])].map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </Select>
            </Field>
            <Button type="submit" loading={saveProfile.isPending} disabled={!profile.formState.isDirty}>Save profile</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Changing your password signs out all other sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={password.handleSubmit((v) => changePassword.mutate(v))} className="space-y-4">
            <Field label="Current password" htmlFor="pw-current" error={we.currentPassword?.message}>
              <Input type="password" autoComplete="current-password" {...fieldA11y('pw-current', we.currentPassword?.message)} {...password.register('currentPassword')} />
            </Field>
            <Field label="New password" htmlFor="pw-new" error={we.newPassword?.message} hint="At least 10 characters with a letter and a number.">
              <Input type="password" autoComplete="new-password" {...fieldA11y('pw-new', we.newPassword?.message)} {...password.register('newPassword')} />
            </Field>
            <Field label="Confirm new password" htmlFor="pw-confirm" error={we.confirm?.message}>
              <Input type="password" autoComplete="new-password" {...fieldA11y('pw-confirm', we.confirm?.message)} {...password.register('confirm')} />
            </Field>
            <Button type="submit" loading={changePassword.isPending}>Update password</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Active sessions</CardTitle>
            <CardDescription>Devices currently signed in to your account.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => revokeOthers.mutate()} loading={revokeOthers.isPending} disabled={(sessions.data?.length ?? 0) <= 1}>Sign out other sessions</Button>
        </CardHeader>
        {sessions.isPending ? (
          <TableSkeleton rows={2} columns={3} />
        ) : sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : (
          <ul className="divide-y border-t">
            {sessions.data.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">{describeAgent(s.userAgent)} {s.current && <Badge tone="success">This device</Badge>}</p>
                  <p className="text-xs text-muted-foreground">{s.ipAddress ?? 'Unknown IP'} · last active {formatRelative(s.lastSeenAt)}</p>
                </div>
                {!s.current && <Button variant="ghost" size="sm" onClick={() => revoke.mutate(s.id)}>Revoke</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
