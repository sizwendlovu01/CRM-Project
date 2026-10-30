'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, CalendarClock, KanbanSquare, ListTodo, Target } from 'lucide-react';
import type { Activity, Paginated, Task } from '@crm/shared';
import { EmptyState, ErrorState } from '@/components/common';
import { PriorityBadge } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/misc';
import { CountTrendChart, PipelineStageChart, RangeControls, RevenueChart, useAnalytics } from '@/features/analytics/charts';
import { buildKpis, KpiGrid, TeamPerformanceTable } from '@/features/analytics/kpis';
import { ACTIVITY_ICONS } from '@/features/activities/timeline';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { me, base, workspaceId, href, workspace, can } = useWorkspace();
  const analytics = useAnalytics();
  const { query } = analytics;
  const tasks = useQuery({
    queryKey: wsKey(workspaceId, 'tasks', 'mine-upcoming'),
    queryFn: () => api<Paginated<Task>>(`${base}/tasks`, { query: { assignedToId: 'me', status: 'TODO', sortBy: 'dueAt', sortDir: 'asc', pageSize: 6 } }),
  });
  const activities = useQuery({
    queryKey: wsKey(workspaceId, 'activities', 'recent'),
    queryFn: () => api<Paginated<Activity>>(`${base}/activities`, { query: { pageSize: 6 } }),
  });

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-2xl border bg-[image:var(--hero-gradient)] p-5 shadow-sm sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-status-teal/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {greeting()}, {me.name.split(' ')[0]}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Here&apos;s how {workspace.name} is performing{workspace.role === 'SALES_REPRESENTATIVE' ? ' (your records)' : ''}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {can('records:create') && (
                <>
                  <Button size="sm" asChild>
                    <Link href={`${href('/customers')}?create=1`}>
                      <Building2 /> Add customer
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`${href('/leads')}?create=1`}>
                      <Target /> Add lead
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`${href('/tasks')}?create=1`}>
                      <ListTodo /> Add task
                    </Link>
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" asChild>
                <Link href={href('/pipeline')}>
                  <KanbanSquare /> Open pipeline
                </Link>
              </Button>
            </div>
          </div>
          <RangeControls {...analytics} />
        </div>
      </section>
      {query.isError ? (
        <Card><ErrorState error={query.error} onRetry={() => void query.refetch()} /></Card>
      ) : (
        <div className="space-y-6">
          <KpiGrid kpis={query.data ? buildKpis(query.data) : undefined} loading={query.isPending} />
          {query.data ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <RevenueChart data={query.data.revenueByPeriod} currency={query.data.currency} />
              <PipelineStageChart data={query.data.pipelineByStage} currency={query.data.currency} />
            </div>
          ) : query.isPending ? (
            <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>My upcoming tasks</CardTitle>
                <Button variant="link" size="sm" asChild><Link href={href('/tasks')}>View all <ArrowRight /></Link></Button>
              </CardHeader>
              <CardContent>
                {tasks.isPending ? (
                  <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-8" />)}</div>
                ) : tasks.isError ? (
                  <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
                ) : tasks.data.data.length === 0 ? (
                  <EmptyState icon={CalendarClock} title="Nothing on your plate" description="Tasks assigned to you will show up here." className="py-6" />
                ) : (
                  <ul className="space-y-3">
                    {tasks.data.data.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3">
                        <Link href={href(`/tasks?taskId=${t.id}`)} className="min-w-0 text-sm hover:text-primary">
                          <span className="block truncate font-medium">{t.title}</span>
                          <span className={cn('text-xs', t.isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>{t.dueAt ? `${t.isOverdue ? 'Overdue · ' : 'Due '}${formatRelative(t.dueAt)}` : 'No due date'}</span>
                        </Link>
                        <PriorityBadge value={t.priority} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <div className="lg:col-span-2">
              {query.data && <CountTrendChart title="Customer acquisition" description="New customers per period" data={query.data.customersByPeriod} name="New customers" />}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">{query.data && <TeamPerformanceTable data={query.data.teamPerformance} currency={query.data.currency} />}</div>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Recent activity</CardTitle>
                <Button variant="link" size="sm" asChild><Link href={href('/activities')}>View all <ArrowRight /></Link></Button>
              </CardHeader>
              <CardContent>
                {activities.isPending ? (
                  <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-8" />)}</div>
                ) : activities.isError ? (
                  <ErrorState error={activities.error} onRetry={() => void activities.refetch()} />
                ) : activities.data.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity logged yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {activities.data.data.map((a) => {
                      const Icon = ACTIVITY_ICONS[a.type];
                      return (
                        <li key={a.id} className="flex gap-3 text-sm">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{a.subject}</p>
                            <p className="truncate text-xs text-muted-foreground">{a.user?.name ?? 'Former member'}{a.customer ? ` · ${a.customer.fullName}` : ''} · {formatRelative(a.occurredAt)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
