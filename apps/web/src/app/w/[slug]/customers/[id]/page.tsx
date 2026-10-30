'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Mail, MapPin, MoreHorizontal, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { humanize, type CustomerDetail, type Deal, type Paginated, type Task } from '@crm/shared';
import { EmptyState, ErrorState, FullPageLoader, PageHeader } from '@/components/common';
import { PriorityBadge, StatusBadge } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Card, CardContent } from '@/components/ui/misc';
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ActivityFormDialog } from '@/features/activities/activity-form';
import { CustomerTimeline, NoteComposer } from '@/features/activities/timeline';
import { CustomerFormDialog } from '@/features/customers/customer-form';
import { DealFormDialog } from '@/features/deals/deal-form';
import { TaskFormDialog } from '@/features/tasks/task-form';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { base, workspaceId, href, can, me, workspace } = useWorkspace();
  const router = useRouter();
  const client = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const customer = useQuery({ queryKey: wsKey(workspaceId, 'customers', 'detail', id), queryFn: () => api<CustomerDetail>(`${base}/customers/${id}`) });
  const deals = useQuery({ queryKey: wsKey(workspaceId, 'deals', 'customer', id), queryFn: () => api<Paginated<Deal>>(`${base}/deals`, { query: { customerId: id, pageSize: 50 } }) });
  const tasks = useQuery({ queryKey: wsKey(workspaceId, 'tasks', 'customer', id), queryFn: () => api<Paginated<Task>>(`${base}/tasks`, { query: { customerId: id, pageSize: 50 } }) });

  const archive = useMutation({
    mutationFn: () => api(`${base}/customers/${id}/${customer.data?.archivedAt ? 'restore' : 'archive'}`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(customer.data?.archivedAt ? 'Customer restored' : 'Customer archived');
      void client.invalidateQueries({ queryKey: wsKey(workspaceId, 'customers') });
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`${base}/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Customer deleted');
      void client.invalidateQueries({ queryKey: wsKey(workspaceId, 'customers') });
      router.replace(href('/customers'));
    },
  });

  if (customer.isPending) return <FullPageLoader />;
  if (customer.isError) return <ErrorState error={customer.error} onRetry={() => void customer.refetch()} />;
  const c = customer.data;
  const canEdit = can('records:update_any') || (can('records:update_own') && (c.assignedTo?.id === me.id || c.createdBy?.id === me.id));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Customers', href: href('/customers') }, { label: c.fullName }]}
        title={c.fullName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {c.company && <span>{c.company}</span>}
            <StatusBadge kind="customer" value={c.status} />
            {c.archivedAt && <Badge tone="warning">Archived</Badge>}
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
            {(canEdit || can('records:delete_any')) && (
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  {canEdit && (
                    <MenuItem onSelect={() => archive.mutate()}>
                      {c.archivedAt ? <ArchiveRestore /> : <Archive />} {c.archivedAt ? 'Restore' : 'Archive'}
                    </MenuItem>
                  )}
                  {can('records:delete_any') && (
                    <>
                      <MenuSeparator />
                      <MenuItem destructive onSelect={() => setConfirmDelete(true)}>
                        <Trash2 /> Delete
                      </MenuItem>
                    </>
                  )}
                </MenuContent>
              </Menu>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center gap-3">
                <Avatar name={c.fullName} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.fullName}</p>
                  <p className="text-sm text-muted-foreground">{humanize(c.type)}{c.industry ? ` · ${c.industry}` : ''}</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {c.email ? <a href={`mailto:${c.email}`} className="truncate hover:text-primary">{c.email}</a> : <span className="text-muted-foreground">No email</span>}
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {c.phone ? <a href={`tel:${c.phone}`} className="hover:text-primary">{c.phone}</a> : <span className="text-muted-foreground">No phone</span>}
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span className={c.address ? '' : 'text-muted-foreground'}>{c.address ?? 'No address'}</span>
                </li>
              </ul>
              <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Representative</dt>
                  <dd className="font-medium">{c.assignedTo?.name ?? 'Unassigned'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Source</dt>
                  <dd className="font-medium">{humanize(c.source)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="font-medium">{formatDate(c.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last interaction</dt>
                  <dd className="font-medium" title={formatDateTime(c.lastInteractionAt)}>{c.lastInteractionAt ? formatRelative(c.lastInteractionAt) : 'Never'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['Open deals', String(c.stats.openDeals)],
              ['Open pipeline', formatCurrency(c.stats.openDealValue, workspace.currency)],
              ['Won revenue', formatCurrency(c.stats.wonDealValue, workspace.currency)],
              ['Open tasks', String(c.stats.openTasks)],
            ].map(([label, value]) => (
              <Card key={label} className="p-4">
                <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                <p className="mt-1 font-[family-name:var(--font-jakarta)] text-lg font-extrabold">{value}</p>
              </Card>
            ))}
          </div>
        </div>

        <Card className="lg:col-span-2">
          <Tabs defaultValue="timeline">
            <div className="border-b px-5 pt-4 pb-3">
              <TabsList>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="deals">Deals ({deals.data?.meta.total ?? 0})</TabsTrigger>
                <TabsTrigger value="tasks">Tasks ({tasks.data?.meta.total ?? 0})</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="timeline" className="space-y-6 p-5">
              <NoteComposer link={{ customerId: id }} />
              <CustomerTimeline customerId={id} />
            </TabsContent>
            <TabsContent value="deals" className="p-5">
              {can('records:create') && (
                <div className="mb-4 flex justify-end">
                  <Button size="sm" onClick={() => setDealOpen(true)}>
                    <Plus /> New deal
                  </Button>
                </div>
              )}
              {deals.isError ? (
                <ErrorState error={deals.error} onRetry={() => void deals.refetch()} />
              ) : deals.data?.data.length === 0 ? (
                <EmptyState title="No deals yet" description="Create a deal to track an opportunity with this customer." />
              ) : (
                <ul className="divide-y rounded-lg border">
                  {deals.data?.data.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <Link href={href(`/deals/${d.id}`)} className="min-w-0 font-medium hover:text-primary">
                        <span className="block truncate">{d.title}</span>
                        <span className="block text-xs font-normal text-muted-foreground">{d.stage.name} · close {formatDate(d.expectedCloseDate)}</span>
                      </Link>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(d.value, d.currency)}</span>
                        <StatusBadge kind="deal" value={d.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="tasks" className="p-5">
              {can('records:create') && (
                <div className="mb-4 flex justify-end">
                  <Button size="sm" onClick={() => setTaskOpen(true)}>
                    <Plus /> New task
                  </Button>
                </div>
              )}
              {tasks.isError ? (
                <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
              ) : tasks.data?.data.length === 0 ? (
                <EmptyState title="No tasks" description="Plan the next step with this customer." />
              ) : (
                <ul className="divide-y rounded-lg border">
                  {tasks.data?.data.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <Link href={href(`/tasks?taskId=${t.id}`)} className="font-medium hover:text-primary">
                        {t.title}
                      </Link>
                      <span className="flex items-center gap-2">
                        <span className={t.isOverdue ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>{t.dueAt ? `Due ${formatDate(t.dueAt)}` : 'No due date'}</span>
                        <PriorityBadge value={t.priority} />
                        <StatusBadge kind="task" value={t.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={c} onSaved={() => void client.invalidateQueries({ queryKey: wsKey(workspaceId, 'customers', 'detail', id) })} />
      <ActivityFormDialog open={activityOpen} onOpenChange={setActivityOpen} link={{ customerId: id, label: c.fullName }} />
      <TaskFormDialog open={taskOpen} onOpenChange={setTaskOpen} defaults={{ customerId: id, customerLabel: c.fullName }} />
      <DealFormDialog open={dealOpen} onOpenChange={setDealOpen} defaults={{ customerId: id, customerLabel: c.fullName }} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete customer?"
        description={<>This permanently deletes <strong>{c.fullName}</strong>, including notes and activities.</>}
        confirmLabel="Delete customer"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
