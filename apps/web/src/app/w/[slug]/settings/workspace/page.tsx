'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { updateWorkspaceSchema, type WorkspaceDetail } from '@crm/shared';
import { Button } from '@/components/ui/button';
import { Field, fieldA11y, Input, Select } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/overlays';
import { api } from '@/lib/api';
import { ME_KEY } from '@/hooks/use-auth';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

type Input = z.input<typeof updateWorkspaceSchema>;
type Output = z.output<typeof updateWorkspaceSchema>;
const CURRENCIES = ['USD', 'ZAR', 'EUR', 'GBP', 'NGN', 'KES', 'AUD', 'CAD', 'INR'];
const TIMEZONES = ['UTC', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Singapore', 'Australia/Sydney'];

export default function WorkspaceSettingsPage() {
  const { workspace, workspaceId, base, can } = useWorkspace();
  const client = useQueryClient();
  const router = useRouter();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const editable = can('workspace:update');

  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(updateWorkspaceSchema),
    values: { name: workspace.name, industry: workspace.industry ?? '', timezone: workspace.timezone, currency: workspace.currency },
  });
  const save = useMutation({
    mutationFn: (values: Output) => api<WorkspaceDetail>(base, { method: 'PATCH', body: values }),
    onSuccess: () => {
      toast.success('Workspace updated');
      void client.invalidateQueries({ queryKey: wsKey(workspaceId) });
      void client.invalidateQueries({ queryKey: ME_KEY });
    },
  });
  const leave = useMutation({
    mutationFn: () => api(`${base}/leave`, { method: 'POST' }),
    onSuccess: async () => {
      toast.success(`You left ${workspace.name}`);
      await client.invalidateQueries({ queryKey: ME_KEY });
      router.replace('/app');
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`${base}/delete`, { method: 'POST', body: { confirmName } }),
    onSuccess: async () => {
      toast.success('Workspace deleted');
      await client.invalidateQueries({ queryKey: ME_KEY });
      router.replace('/app');
    },
  });
  const errors = form.formState.errors;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>{editable ? 'Basic information about your workspace.' : 'Only owners and admins can change workspace settings.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <fieldset disabled={!editable} className="contents">
              <Field label="Workspace name" htmlFor="ws-name" error={errors.name?.message} className="sm:col-span-2">
                <Input {...fieldA11y('ws-name', errors.name?.message)} {...form.register('name')} />
              </Field>
              <Field label="Industry" htmlFor="ws-industry" error={errors.industry?.message}>
                <Input {...fieldA11y('ws-industry', errors.industry?.message)} {...form.register('industry')} />
              </Field>
              <Field label="Currency" htmlFor="ws-currency" error={errors.currency?.message}>
                <Select id="ws-currency" {...form.register('currency')}>
                  {[...new Set([workspace.currency, ...CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Timezone" htmlFor="ws-timezone">
                <Select id="ws-timezone" {...form.register('timezone')}>
                  {[...new Set([workspace.timezone, ...TIMEZONES])].map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </Select>
              </Field>
              <Field label="Workspace URL" htmlFor="ws-slug" hint="The URL identifier cannot be changed.">
                <Input id="ws-slug" value={`/w/${workspace.slug}`} readOnly disabled />
              </Field>
              {editable && (
                <div className="sm:col-span-2">
                  <Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty}>Save changes</Button>
                </div>
              )}
            </fieldset>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {workspace.role !== 'OWNER' && (
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium">Leave workspace</p>
                <p className="text-sm text-muted-foreground">You will lose access until you are invited again. Your open work will be unassigned.</p>
              </div>
              <Button variant="outline" onClick={() => setLeaveOpen(true)}>Leave workspace</Button>
            </div>
          )}
          {can('workspace:delete') && (
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium">Delete workspace</p>
                <p className="text-sm text-muted-foreground">Permanently deletes the workspace and all of its customers, leads, deals, tasks and activities.</p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete workspace</Button>
            </div>
          )}
          {workspace.role === 'OWNER' && <p className="text-xs text-muted-foreground">To leave this workspace, first transfer ownership from the Team page.</p>}
        </CardContent>
      </Card>

      <ConfirmDialog open={leaveOpen} onOpenChange={setLeaveOpen} title={`Leave ${workspace.name}?`} description="You will immediately lose access to this workspace." confirmLabel="Leave workspace" loading={leave.isPending} onConfirm={() => leave.mutate()} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => { setDeleteOpen(o); if (!o) setConfirmName(''); }}
        title="Delete this workspace permanently?"
        confirmLabel="Delete workspace"
        loading={remove.isPending}
        onConfirm={() => confirmName === workspace.name ? remove.mutate() : toast.error('The name does not match.')}
        description={
          <div className="space-y-3">
            <p>This cannot be undone. Type <strong>{workspace.name}</strong> to confirm.</p>
            <Input aria-label="Workspace name confirmation" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
          </div>
        }
      />
    </div>
  );
}
