'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity as ActivityIcon, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ACTIVITY_TYPES, humanize, type Activity, type Paginated } from '@crm/shared';
import { EmptyState, ErrorState, PageHeader, Pagination, SearchInput, TableSkeleton } from '@/components/common';
import { EnumOptions } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Card } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/overlays';
import { ActivityFormDialog } from '@/features/activities/activity-form';
import { ACTIVITY_ICONS } from '@/features/activities/timeline';
import { api } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useListState } from '@/hooks/use-list-state';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

export default function ActivitiesPage() {
  const { base, workspaceId, members, can, href, me } = useWorkspace();
  const client = useQueryClient();
  const list = useListState<{ type: string; userId: string }, 'occurredAt'>({ filters: { type: '', userId: '' }, sortBy: 'occurredAt' });
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const { sortBy: _sortBy, ...query } = list.query;
  const data = useQuery({
    queryKey: wsKey(workspaceId, 'activities', 'list', query),
    queryFn: () => api<Paginated<Activity>>(`${base}/activities`, { query }),
    placeholderData: keepPreviousData,
  });
  const remove = useMutation({
    mutationFn: (a: Activity) => api(`${base}/activities/${a.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Activity deleted');
      setDeleting(null);
      void client.invalidateQueries({ queryKey: wsKey(workspaceId) });
    },
  });

  return (
    <>
      <PageHeader title="Activities" description="Calls, emails, meetings, notes and follow-ups across the workspace." actions={can('records:create') && <Button onClick={() => setOpen(true)}><Plus /> Log activity</Button>} />
      <Card>
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search activities…" className="sm:w-72" label="Search activities" />
          <div className="flex flex-1 gap-2 sm:justify-end">
            <Select aria-label="Filter by type" value={list.filters.type} onChange={(e) => list.setFilter('type', e.target.value)} className="sm:w-40">
              <EnumOptions values={ACTIVITY_TYPES} includeEmpty="All types" />
            </Select>
            <Select aria-label="Filter by teammate" value={list.filters.userId} onChange={(e) => list.setFilter('userId', e.target.value)} className="sm:w-44">
              <option value="">Everyone</option>
              {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
            </Select>
          </div>
        </div>
        {data.isPending ? (
          <TableSkeleton />
        ) : data.isError ? (
          <ErrorState error={data.error} onRetry={() => void data.refetch()} />
        ) : data.data.data.length === 0 ? (
          <EmptyState icon={ActivityIcon} title={list.activeFilters ? 'No activities match your filters' : 'No activities yet'} description="Logged interactions appear here and on customer timelines." />
        ) : (
          <>
            <ul className="divide-y" aria-label="Activities">
              {data.data.data.map((a) => {
                const Icon = ACTIVITY_ICONS[a.type];
                const canDelete = can('records:update_any') || (can('records:update_own') && a.user?.id === me.id);
                return (
                  <li key={a.id} className="flex gap-3 px-4 py-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{a.subject}</span>{' '}
                        <span className="text-muted-foreground">· {humanize(a.type)}{a.durationMinutes ? ` · ${a.durationMinutes} min` : ''}{a.outcome ? ` · ${a.outcome}` : ''}</span>
                      </p>
                      {a.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.user?.name ?? 'Former member'}
                        {a.customer && <> · <Link href={href(`/customers/${a.customer.id}`)} className="hover:text-primary">{a.customer.fullName}</Link></>}
                        {a.deal && <> · <Link href={href(`/deals/${a.deal.id}`)} className="hover:text-primary">{a.deal.title}</Link></>}
                        {a.lead && <> · <Link href={href(`/leads/${a.lead.id}`)} className="hover:text-primary">{a.lead.fullName}</Link></>}
                        {' · '}
                        <time dateTime={a.occurredAt} title={formatDateTime(a.occurredAt)}>{formatRelative(a.occurredAt)}</time>
                      </p>
                    </div>
                    {canDelete && (
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete activity ${a.subject}`} onClick={() => setDeleting(a)}><Trash2 /></Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pagination meta={data.data.meta} onPageChange={list.setPage} />
          </>
        )}
      </Card>
      <ActivityFormDialog open={open} onOpenChange={setOpen} />
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)} title="Delete activity?" description="This activity will be removed from the timeline." confirmLabel="Delete" loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} />
    </>
  );
}
