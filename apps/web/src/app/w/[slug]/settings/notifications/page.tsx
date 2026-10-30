'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { humanize, type NotificationPreference } from '@crm/shared';
import { ErrorState, TableSkeleton } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle, Table, TBody, TD, TH, THead, TR } from '@/components/ui/misc';
import { Switch } from '@/components/ui/overlays';
import { api } from '@/lib/api';

const DESCRIPTIONS: Record<string, string> = {
  TASK_ASSIGNED: 'A task is assigned to you or commented on',
  WORKSPACE_INVITATION: 'You are invited to a workspace',
  LEAD_ASSIGNED: 'A lead is assigned to you',
  DEAL_ASSIGNED: 'A deal is assigned to you',
  DEAL_UPDATED: 'A deal you own changes stage or value',
  TASK_DUE_SOON: 'A task is due within 24 hours',
  TASK_OVERDUE: 'A task becomes overdue',
  CUSTOMER_ACTIVITY: 'Someone logs a call, email or meeting with your customer',
  MEMBER_JOINED: 'Someone accepts your invitation',
};

export default function NotificationPreferencesPage() {
  const prefs = useQuery({ queryKey: ['notification-preferences'], queryFn: () => api<NotificationPreference[]>('/notifications/preferences') });
  const [draft, setDraft] = useState<NotificationPreference[]>([]);
  useEffect(() => {
    if (prefs.data) setDraft(prefs.data);
  }, [prefs.data]);
  const save = useMutation({
    mutationFn: () => api<NotificationPreference[]>('/notifications/preferences', { method: 'PUT', body: { preferences: draft } }),
    onSuccess: (data) => {
      setDraft(data);
      toast.success('Notification preferences saved');
    },
  });
  const dirty = JSON.stringify(draft) !== JSON.stringify(prefs.data);
  const update = (type: string, key: 'inApp' | 'email', value: boolean) => setDraft((d) => d.map((p) => (p.type === type ? { ...p, [key]: value } : p)));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Notification preferences</CardTitle>
          <CardDescription>Choose how you are notified. Applies to all of your workspaces. Local emails are delivered to Mailpit.</CardDescription>
        </div>
        <Button onClick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>Save preferences</Button>
      </CardHeader>
      {prefs.isPending ? (
        <TableSkeleton rows={6} columns={3} />
      ) : prefs.isError ? (
        <ErrorState error={prefs.error} onRetry={() => void prefs.refetch()} />
      ) : (
        <Table aria-label="Notification preferences">
          <THead>
            <tr>
              <TH>Event</TH>
              <TH className="w-24 text-center">In-app</TH>
              <TH className="w-24 text-center">Email</TH>
            </tr>
          </THead>
          <TBody>
            {draft.map((p) => (
              <TR key={p.type}>
                <TD>
                  <p className="font-medium">{humanize(p.type)}</p>
                  <p className="text-xs text-muted-foreground">{DESCRIPTIONS[p.type]}</p>
                </TD>
                <TD className="text-center"><Switch checked={p.inApp} onCheckedChange={(v) => update(p.type, 'inApp', v)} aria-label={`${humanize(p.type)} in-app`} /></TD>
                <TD className="text-center"><Switch checked={p.email} onCheckedChange={(v) => update(p.type, 'email', v)} aria-label={`${humanize(p.type)} email`} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
