'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { humanize, type Activity, type Deal, type Note, type Paginated, type Pipeline, type Task } from '@crm/shared';
import { EmptyState, ErrorState, FullPageLoader, PageHeader } from '@/components/common';
import { PriorityBadge, StatusBadge } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/misc';
import { ActivityFormDialog } from '@/features/activities/activity-form';
import { ACTIVITY_ICONS, NoteComposer } from '@/features/activities/timeline';
import { DealFormDialog } from '@/features/deals/deal-form';
import { TaskFormDialog } from '@/features/tasks/task-form';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, formatRelative } from '@/lib/format';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { base, workspaceId, href, can, me } = useWorkspace();
  const client = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const deal = useQuery({ queryKey: wsKey(workspaceId, 'deals', 'detail', id), queryFn: () => api<Deal>(`${base}/deals/${id}`) });
  const pipeline = useQuery({
    queryKey: wsKey(workspaceId, 'pipelines', deal.data?.pipelineId),
    queryFn: () => api<Pipeline>(`${base}/pipelines/${deal.data!.pipelineId}`),
    enabled: Boolean(deal.data),
  });
  const tasks = useQuery({ queryKey: wsKey(workspaceId, 'tasks', 'deal', id), queryFn: () => api<Paginated<Task>>(`${base}/tasks`, { query: { dealId: id, pageSize: 50 } }) });
  const activities = useQuery({ queryKey: wsKey(workspaceId, 'activities', 'deal', id), queryFn: () => api<Paginated<Activity>>(`${base}/activities`, { query: { dealId: id, pageSize: 50 } }) });
  const notes = useQuery({ queryKey: wsKey(workspaceId, 'notes', 'deal', id), queryFn: () => api<Note[]>(`${base}/notes`, { query: { dealId: id } }) });

  const move = useMutation({
    mutationFn: (stageId: string) => api<Deal>(`${base}/deals/${id}/move`, { method: 'POST', body: { stageId } }),
    onSuccess: (d) => {
      toast.success(`Moved to ${d.stage.name}`);
      void client.invalidateQueries({ queryKey: wsKey(workspaceId) });
    },
  });

  if (deal.isPending) return <FullPageLoader />;
  if (deal.isError) return <ErrorState error={deal.error} onRetry={() => void deal.refetch()} />;
  const d = deal.data;
  const canEdit = can('records:update_any') || (can('records:update_own') && (d.assignedTo?.id === me.id || d.createdBy?.id === me.id));

  const feed = [
    ...(notes.data ?? []).map((n) => ({ key: `n-${n.id}`, at: n.createdAt, by: n.author?.name, body: <p className="whitespace-pre-line rounded-lg border bg-muted/30 px-3 py-2 text-sm">{n.body}</p>, icon: null as React.ReactNode })),
    ...(activities.data?.data ?? []).map((a) => {
      const Icon = ACTIVITY_ICONS[a.type];
      return { key: `a-${a.id}`, at: a.occurredAt, by: a.user?.name, body: <p className="text-sm"><span className="font-medium">{a.subject}</span> <span className="text-muted-foreground">· {humanize(a.type)}</span></p>, icon: <Icon className="h-4 w-4 text-muted-foreground" /> };
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Deals', href: href('/deals') }, { label: d.title }]}
        title={d.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{formatCurrency(d.value, d.currency)}</span>
            <StatusBadge kind="deal" value={d.status} />
            {d.customer && (
              <Link href={href(`/customers/${d.customer.id}`)} className="hover:text-primary">
                {d.customer.fullName}
              </Link>
            )}
          </span>
        }
        actions={
          <>
            {can('records:create') && (
              <Button variant="outline" onClick={() => setActivityOpen(true)}>
                <Plus /> Log activity
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
            )}
          </>
        }
      />

      {pipeline.data && (
        <ol className="mb-6 flex overflow-x-auto rounded-lg border bg-card" aria-label="Deal stage">
          {pipeline.data.stages.map((s) => {
            const current = s.id === d.stageId;
            return (
              <li key={s.id} className="min-w-28 flex-1">
                <button
                  type="button"
                  disabled={!canEdit || current || move.isPending}
                  onClick={() => move.mutate(s.id)}
                  aria-current={current ? 'step' : undefined}
                  className={`h-full w-full border-r px-3 py-2.5 text-xs font-medium transition-colors last:border-r-0 disabled:cursor-default ${current ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted enabled:hover:text-foreground'}`}
                >
                  {s.name}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                {(
                  [
                    ['Stage', d.stage.name],
                    ['Probability', `${d.effectiveProbability}%${d.probability === null ? ' (stage default)' : ''}`],
                    ['Weighted value', formatCurrency((d.value * d.effectiveProbability) / 100, d.currency)],
                    ['Expected close', formatDate(d.expectedCloseDate)],
                    ['Closed', formatDate(d.closedAt)],
                    ['Owner', d.assignedTo?.name ?? 'Unassigned'],
                    ['Created', formatDate(d.createdAt)],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
                {d.lostReason && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Lost reason</dt>
                    <dd className="text-right font-medium">{d.lostReason}</dd>
                  </div>
                )}
              </dl>
              {d.description && <p className="mt-4 whitespace-pre-line border-t pt-4 text-sm text-muted-foreground">{d.description}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Tasks</CardTitle>
              {can('records:create') && (
                <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}>
                  <Plus /> Add
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {tasks.data?.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks for this deal.</p>
              ) : (
                <ul className="space-y-2">
                  {tasks.data?.data.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={href(`/tasks?taskId=${t.id}`)} className="truncate hover:text-primary">{t.title}</Link>
                      <span className="flex shrink-0 items-center gap-1">
                        <PriorityBadge value={t.priority} />
                        <StatusBadge kind="task" value={t.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notes &amp; activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <NoteComposer link={{ dealId: id }} />
            {feed.length === 0 ? (
              <EmptyState title="Nothing logged yet" description="Notes and activities for this deal will appear here." />
            ) : (
              <ul className="space-y-4">
                {feed.map((item) => (
                  <li key={item.key} className="flex gap-3">
                    <span className="mt-1 w-4">{item.icon}</span>
                    <div className="flex-1">
                      {item.body}
                      <p className="mt-1 text-xs text-muted-foreground">{item.by ?? 'Former member'} · {formatRelative(item.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {canEdit && pipeline.data && (
        <div className="mt-6 sm:hidden">
          <label htmlFor="mobile-stage" className="mb-1 block text-sm font-medium">Move to stage</label>
          <Select id="mobile-stage" value={d.stageId} onChange={(e) => move.mutate(e.target.value)}>
            {pipeline.data.stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
      )}

      <DealFormDialog open={editOpen} onOpenChange={setEditOpen} deal={d} />
      <TaskFormDialog open={taskOpen} onOpenChange={setTaskOpen} defaults={{ dealId: id, dealLabel: d.title, customerId: d.customer?.id, customerLabel: d.customer?.fullName }} />
      <ActivityFormDialog open={activityOpen} onOpenChange={setActivityOpen} link={{ dealId: id, customerId: d.customer?.id, label: d.title }} />
    </>
  );
}
