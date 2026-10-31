'use client';

import { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ListTodo, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PRIORITIES, TASK_STATUSES, type Paginated, type Task, type TaskComment } from '@crm/shared';
import { EmptyState, ErrorState, PageHeader, Pagination, SearchInput, SortButton, TableSkeleton } from '@/components/common';
import { EnumOptions, PriorityBadge, StatusBadge } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/input';
import { Avatar, Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/misc';
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal } from '@/components/ui/overlays';
import { TaskFormDialog } from '@/features/tasks/task-form';
import { api } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ariaSort, useListState } from '@/hooks/use-list-state';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';
import { useCreateParam } from '@/hooks/use-create-param';

type SortField = 'dueAt' | 'priority' | 'title' | 'createdAt';

function TaskDrawer({ taskId, onClose, onEdit }: { taskId: string; onClose: () => void; onEdit: (task: Task) => void }) {
  const { base, workspaceId, href, can } = useWorkspace();
  const client = useQueryClient();
  const [body, setBody] = useState('');
  const task = useQuery({ queryKey: wsKey(workspaceId, 'tasks', 'detail', taskId), queryFn: () => api<Task>(`${base}/tasks/${taskId}`) });
  const comments = useQuery({ queryKey: wsKey(workspaceId, 'tasks', 'comments', taskId), queryFn: () => api<TaskComment[]>(`${base}/tasks/${taskId}/comments`) });
  const addComment = useMutation({
    mutationFn: () => api(`${base}/tasks/${taskId}/comments`, { method: 'POST', body: { body } }),
    onSuccess: () => {
      setBody('');
      void client.invalidateQueries({ queryKey: wsKey(workspaceId, 'tasks') });
    },
  });
  const t = task.data;
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={t?.title ?? 'Task'} variant="sheet">
      {task.isPending ? (
        <TableSkeleton rows={4} columns={2} />
      ) : task.isError ? (
        <ErrorState error={task.error} onRetry={() => void task.refetch()} />
      ) : t ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="task" value={t.status} />
            <PriorityBadge value={t.priority} />
            {t.isOverdue && <span className="text-xs font-medium text-destructive">Overdue</span>}
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => onEdit(t)}>
              <Pencil /> Edit
            </Button>
          </div>
          {t.description && <p className="whitespace-pre-line text-sm">{t.description}</p>}
          <dl className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">Due</dt><dd className="font-medium">{formatDateTime(t.dueAt)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Assignee</dt><dd className="font-medium">{t.assignedTo?.name ?? 'Unassigned'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Customer</dt><dd className="font-medium">{t.customer ? <Link href={href(`/customers/${t.customer.id}`)} className="hover:text-primary">{t.customer.fullName}</Link> : '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Deal</dt><dd className="font-medium">{t.deal ? <Link href={href(`/deals/${t.deal.id}`)} className="hover:text-primary">{t.deal.title}</Link> : '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Created by</dt><dd className="font-medium">{t.createdBy?.name ?? '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Completed</dt><dd className="font-medium">{formatDateTime(t.completedAt)}</dd></div>
          </dl>
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4" /> Comments</h3>
            {comments.data?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
            <ul className="space-y-3">
              {comments.data?.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <Avatar name={c.author?.name ?? '?'} size="sm" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{c.author?.name ?? 'Former member'}</span>, {formatRelative(c.createdAt)}</p>
                    <p className="mt-0.5 whitespace-pre-line text-sm">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            {can('records:create') && (
              <form className="mt-4 space-y-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) addComment.mutate(); }}>
                <label htmlFor="comment-body" className="sr-only">Write a comment</label>
                <Textarea id="comment-body" rows={2} placeholder="Write a comment…" value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} />
                <div className="flex justify-end"><Button type="submit" size="sm" disabled={!body.trim()} loading={addComment.isPending}>Comment</Button></div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </Modal>
  );
}

function TasksView() {
  const { base, workspaceId, members, can, me } = useWorkspace();
  const client = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openTaskId = params.get('taskId');
  const list = useListState<{ status: string; priority: string; assignedToId: string; due: string }, SortField>({
    filters: { status: '', priority: '', assignedToId: '', due: '' },
    sortBy: 'dueAt',
    sortDir: 'asc',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();
  const [deleting, setDeleting] = useState<Task | null>(null);
  const openCreate = useCallback(() => {
    setEditing(undefined);
    setFormOpen(true);
  }, []);
  useCreateParam(openCreate, can('records:create'));

  const data = useQuery({
    queryKey: wsKey(workspaceId, 'tasks', 'list', list.query),
    queryFn: () => api<Paginated<Task>>(`${base}/tasks`, { query: list.query }),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => client.invalidateQueries({ queryKey: wsKey(workspaceId) });
  const toggle = useMutation({
    mutationFn: (t: Task) => api<Task>(`${base}/tasks/${t.id}`, { method: 'PATCH', body: { status: t.status === 'COMPLETED' ? 'TODO' : 'COMPLETED' } }),
    onSuccess: (t) => {
      toast.success(t.status === 'COMPLETED' ? 'Task completed' : 'Task reopened');
      void invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (t: Task) => api(`${base}/tasks/${t.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Task deleted');
      setDeleting(null);
      void invalidate();
    },
  });

  const canEdit = (t: Task) => can('records:update_any') || (can('records:update_own') && (t.assignedTo?.id === me.id || t.createdBy?.id === me.id));
  const openTask = (id: string | null) => router.replace(id ? `${pathname}?taskId=${id}` : pathname, { scroll: false });
  const header = (field: SortField, label: string, className?: string) => (
    <TH aria-sort={ariaSort(list.sortBy === field, list.sortDir)} className={className}>
      <SortButton label={label} active={list.sortBy === field} direction={list.sortDir} onClick={() => list.toggleSort(field)} />
    </TH>
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        icon={ListTodo}
        iconTone="amber"
        description="Follow-ups and to-dos for you and your team."
        actions={can('records:create') && <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus /> New task</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Quick filters">
        {[
          ['', 'All'],
          ['overdue', 'Overdue'],
          ['today', 'Due today'],
          ['week', 'Next 7 days'],
          ['none', 'No due date'],
        ].map(([value, label]) => (
          <Button key={value} size="sm" variant={list.filters.due === value ? 'default' : 'outline'} aria-pressed={list.filters.due === value} onClick={() => list.setFilter('due', value!)}>
            {label}
          </Button>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search tasks…" className="lg:w-72" label="Search tasks" />
          <div className="grid flex-1 grid-cols-3 gap-2 lg:flex lg:justify-end">
            <Select aria-label="Filter by status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} className="lg:w-36">
              <EnumOptions values={TASK_STATUSES} includeEmpty="All statuses" />
            </Select>
            <Select aria-label="Filter by priority" value={list.filters.priority} onChange={(e) => list.setFilter('priority', e.target.value)} className="lg:w-36">
              <EnumOptions values={PRIORITIES} includeEmpty="All priorities" />
            </Select>
            <Select aria-label="Filter by assignee" value={list.filters.assignedToId} onChange={(e) => list.setFilter('assignedToId', e.target.value)} className="lg:w-44">
              <option value="">Everyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
            </Select>
          </div>
        </div>
        {data.isPending ? (
          <TableSkeleton />
        ) : data.isError ? (
          <ErrorState error={data.error} onRetry={() => void data.refetch()} />
        ) : data.data.data.length === 0 ? (
          list.activeFilters > 0 ? (
            <EmptyState icon={CalendarClock} title="No tasks match these filters" action={<Button variant="outline" onClick={list.resetFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={ListTodo} title="No tasks yet" description="Create a task to plan your next step." action={can('records:create') ? <Button onClick={() => setFormOpen(true)}><Plus /> New task</Button> : undefined} />
          )
        ) : (
          <>
            <Table aria-label="Tasks" className={data.isFetching ? 'opacity-70 transition-opacity' : undefined}>
              <THead>
                <tr>
                  <TH className="w-10"><span className="sr-only">Done</span></TH>
                  {header('title', 'Task')}
                  {header('dueAt', 'Due')}
                  {header('priority', 'Priority')}
                  <TH className="hidden md:table-cell">Status</TH>
                  <TH className="hidden lg:table-cell">Assignee</TH>
                  <TH className="w-10"><span className="sr-only">Actions</span></TH>
                </tr>
              </THead>
              <TBody>
                {data.data.data.map((t) => (
                  <TR key={t.id}>
                    <TD>
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
                        checked={t.status === 'COMPLETED'}
                        disabled={!canEdit(t) || toggle.isPending}
                        onChange={() => toggle.mutate(t)}
                        aria-label={`Mark "${t.title}" as ${t.status === 'COMPLETED' ? 'not done' : 'done'}`}
                      />
                    </TD>
                    <TD>
                      <button type="button" onClick={() => openTask(t.id)} className={cn('text-left font-medium hover:text-primary', t.status === 'COMPLETED' && 'text-muted-foreground line-through')}>
                        {t.title}
                      </button>
                      <span className="block text-xs text-muted-foreground">
                        {[t.customer?.fullName, t.deal?.title].filter(Boolean).join(', ') || '—'}
                        {t.commentCount > 0 && <span className="ml-2 inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{t.commentCount}</span>}
                      </span>
                    </TD>
                    <TD className={cn('whitespace-nowrap text-sm', t.isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      {t.dueAt ? <span title={formatDateTime(t.dueAt)}>{t.isOverdue ? 'Overdue, ' : ''}{formatRelative(t.dueAt)}</span> : '—'}
                    </TD>
                    <TD><PriorityBadge value={t.priority} /></TD>
                    <TD className="hidden md:table-cell"><StatusBadge kind="task" value={t.status} /></TD>
                    <TD className="hidden lg:table-cell">{t.assignedTo?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TD>
                    <TD>
                      {canEdit(t) && (
                        <Menu>
                          <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.title}`}><MoreHorizontal /></Button></MenuTrigger>
                          <MenuContent>
                            <MenuItem onSelect={() => { setEditing(t); setFormOpen(true); }}><Pencil /> Edit</MenuItem>
                            <MenuSeparator />
                            <MenuItem destructive onSelect={() => setDeleting(t)}><Trash2 /> Delete</MenuItem>
                          </MenuContent>
                        </Menu>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination meta={data.data.meta} onPageChange={list.setPage} />
          </>
        )}
      </Card>
      {openTaskId && <TaskDrawer taskId={openTaskId} onClose={() => openTask(null)} onEdit={(t) => { setEditing(t); setFormOpen(true); }} />}
      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editing} />
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)} title="Delete task?" description={<>“{deleting?.title}” and its comments will be permanently deleted.</>} confirmLabel="Delete task" loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} />
    </>
  );
}

export default function TasksPage() {
  return (
    <Suspense>
      <TasksView />
    </Suspense>
  );
}
