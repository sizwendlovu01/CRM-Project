'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, CalendarClock, CheckSquare, Mail, MessageSquare, Phone, StickyNote, Users } from 'lucide-react';
import { toast } from 'sonner';
import { humanize, type ActivityType, type TimelineItem } from '@crm/shared';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common';
import { StatusBadge } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

export const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  NOTE: StickyNote,
  FOLLOW_UP: CalendarClock,
};

export function NoteComposer({ link }: { link: { customerId?: string; leadId?: string; dealId?: string } }) {
  const { base, workspaceId, can } = useWorkspace();
  const client = useQueryClient();
  const [body, setBody] = useState('');
  const add = useMutation({
    mutationFn: () => api(`${base}/notes`, { method: 'POST', body: { body, ...link } }),
    onSuccess: () => {
      setBody('');
      toast.success('Note added');
      void client.invalidateQueries({ queryKey: wsKey(workspaceId) });
    },
  });
  if (!can('records:create')) return null;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) add.mutate();
      }}
      className="space-y-2"
    >
      <label htmlFor="note-body" className="sr-only">
        Add a note
      </label>
      <Textarea id="note-body" placeholder="Add a note…" value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={10000} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!body.trim()} loading={add.isPending}>
          Add note
        </Button>
      </div>
    </form>
  );
}

function ItemIcon({ item }: { item: TimelineItem }) {
  const Icon = item.kind === 'activity' ? ACTIVITY_ICONS[item.activity.type] : item.kind === 'note' ? MessageSquare : item.kind === 'task' ? CheckSquare : Briefcase;
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card',
        item.kind === 'activity' && 'bg-accent text-accent-foreground',
        item.kind === 'note' && 'bg-warning-soft text-warning',
        item.kind === 'task' && 'bg-info-soft text-info',
        item.kind === 'deal' && 'bg-success-soft text-success',
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function CustomerTimeline({ customerId }: { customerId: string }) {
  const { base, workspaceId, workspace } = useWorkspace();
  const data = useQuery({
    queryKey: wsKey(workspaceId, 'timeline', customerId),
    queryFn: () => api<TimelineItem[]>(`${base}/customers/${customerId}/timeline`),
  });
  if (data.isPending) return <TableSkeleton rows={4} columns={2} />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => void data.refetch()} />;
  if (data.data.length === 0) return <EmptyState icon={CalendarClock} title="No activity yet" description="Log a call, meeting or note to start the timeline." />;

  return (
    <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-border" aria-label="Customer timeline">
      {data.data.map((item) => (
        <li key={`${item.kind}-${item.kind === 'activity' ? item.activity.id : item.kind === 'note' ? item.note.id : item.kind === 'task' ? item.task.id : item.deal.id}`} className="relative flex gap-3">
          <ItemIcon item={item} />
          <div className="min-w-0 flex-1 pt-1">
            {item.kind === 'activity' && (
              <>
                <p className="text-sm">
                  <span className="font-medium">{item.activity.subject}</span>{' '}
                  <span className="text-muted-foreground">
                    · {humanize(item.activity.type)}
                    {item.activity.durationMinutes ? ` · ${item.activity.durationMinutes} min` : ''}
                    {item.activity.outcome ? ` · ${item.activity.outcome}` : ''}
                  </span>
                </p>
                {item.activity.description && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{item.activity.description}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.activity.user?.name ?? 'Former member'} · <time dateTime={item.at} title={formatDateTime(item.at)}>{formatRelative(item.at)}</time>
                </p>
              </>
            )}
            {item.kind === 'note' && (
              <>
                <p className="whitespace-pre-line rounded-lg border bg-muted/30 px-3 py-2 text-sm">{item.note.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Note by {item.note.author?.name ?? 'former member'} · <time dateTime={item.at}>{formatRelative(item.at)}</time>
                </p>
              </>
            )}
            {item.kind === 'task' && (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                Task <span className="font-medium">{item.task.title}</span> <StatusBadge kind="task" value={item.task.status} />
                <span className="text-xs text-muted-foreground">{formatRelative(item.at)}</span>
              </p>
            )}
            {item.kind === 'deal' && (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                Deal <span className="font-medium">{item.deal.title}</span> · {formatCurrency(item.deal.value, workspace.currency)} <StatusBadge kind="deal" value={item.deal.status} />
                <span className="text-xs text-muted-foreground">{formatRelative(item.at)}</span>
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
