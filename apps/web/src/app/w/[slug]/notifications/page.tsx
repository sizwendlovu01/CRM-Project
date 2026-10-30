'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, MailOpen, Mail } from 'lucide-react';
import { humanize, type NotificationDto, type Paginated } from '@crm/shared';
import { EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/misc';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { api } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

export default function NotificationsPage() {
  const { workspaceId, href } = useWorkspace();
  const client = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const data = useQuery({
    queryKey: wsKey(workspaceId, 'notifications', 'page', unreadOnly, page),
    queryFn: () => api<Paginated<NotificationDto> & { unreadCount: number }>('/notifications', { query: { workspaceId, unreadOnly, page, pageSize: 20 } }),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => client.invalidateQueries({ queryKey: wsKey(workspaceId, 'notifications') });
  const toggle = useMutation({
    mutationFn: (n: NotificationDto) => api(`/notifications/${n.id}/${n.readAt ? 'unread' : 'read'}`, { method: 'POST' }),
    onSuccess: () => void invalidate(),
  });
  const markAll = useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST', query: { workspaceId } }), onSuccess: () => void invalidate() });

  return (
    <>
      <PageHeader
        title="Notifications"
        icon={Bell}
        iconTone="blue"
        description="Assignments, deal updates, reminders and invitations."
        actions={
          <>
            <Button variant="outline" asChild><Link href={href('/settings/notifications')}>Preferences</Link></Button>
            <Button onClick={() => markAll.mutate()} disabled={!data.data?.unreadCount} loading={markAll.isPending}><CheckCheck /> Mark all as read</Button>
          </>
        }
      />
      <Tabs value={unreadOnly ? 'unread' : 'all'} onValueChange={(v) => { setUnreadOnly(v === 'unread'); setPage(1); }} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread{data.data?.unreadCount ? ` (${data.data.unreadCount})` : ''}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="overflow-hidden">
        {data.isPending ? (
          <TableSkeleton rows={5} columns={2} />
        ) : data.isError ? (
          <ErrorState error={data.error} onRetry={() => void data.refetch()} />
        ) : data.data.data.length === 0 ? (
          <EmptyState icon={Bell} title={unreadOnly ? 'No unread notifications' : 'No notifications yet'} description="You'll be notified about assignments, deal changes and due dates." />
        ) : (
          <>
            <ul className="divide-y" aria-label="Notifications">
              {data.data.data.map((n) => (
                <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3', !n.readAt && 'bg-accent/30')}>
                  <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-border' : 'bg-primary')} aria-label={n.readAt ? 'Read' : 'Unread'} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', !n.readAt && 'font-medium')}>
                      {n.link ? (
                        <Link href={n.link} onClick={() => !n.readAt && toggle.mutate(n)} className="hover:text-primary">{n.title}</Link>
                      ) : (
                        n.title
                      )}
                    </p>
                    {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge>{humanize(n.type)}</Badge>
                      <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>{formatRelative(n.createdAt)}</time>
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={n.readAt ? 'Mark as unread' : 'Mark as read'} onClick={() => toggle.mutate(n)}>
                    {n.readAt ? <Mail /> : <MailOpen />}
                  </Button>
                </li>
              ))}
            </ul>
            <Pagination meta={data.data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
