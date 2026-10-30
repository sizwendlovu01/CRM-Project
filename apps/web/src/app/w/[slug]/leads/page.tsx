'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ArrowRightLeft, MoreHorizontal, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LEAD_STATUSES, PRIORITIES, RECORD_SOURCES, type Lead, type Paginated } from '@crm/shared';
import { EmptyState, ErrorState, PageHeader, Pagination, SearchInput, SortButton, TableSkeleton } from '@/components/common';
import { EnumOptions, PriorityBadge, StatusBadge } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/misc';
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/overlays';
import { ConvertLeadDialog, LeadFormDialog } from '@/features/leads/lead-forms';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { ariaSort, useListState } from '@/hooks/use-list-state';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';
import { useCreateParam } from '@/hooks/use-create-param';

type SortField = 'fullName' | 'company' | 'status' | 'priority' | 'nextFollowUpAt' | 'createdAt';

export default function LeadsPage() {
  const { base, workspaceId, members, can, href, me, workspace } = useWorkspace();
  const router = useRouter();
  const client = useQueryClient();
  const list = useListState<{ status: string; priority: string; source: string; assignedToId: string; archived: string }, SortField>({
    filters: { status: '', priority: '', source: '', assignedToId: '', archived: '' },
    sortBy: 'createdAt',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | undefined>();
  const [converting, setConverting] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const openCreate = useCallback(() => {
    setEditing(undefined);
    setFormOpen(true);
  }, []);
  useCreateParam(openCreate, can('records:create'));

  const data = useQuery({
    queryKey: wsKey(workspaceId, 'leads', 'list', list.query),
    queryFn: () => api<Paginated<Lead>>(`${base}/leads`, { query: list.query }),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => client.invalidateQueries({ queryKey: wsKey(workspaceId, 'leads') });
  const archive = useMutation({
    mutationFn: (l: Lead) => api<Lead>(`${base}/leads/${l.id}/${l.archivedAt ? 'restore' : 'archive'}`, { method: 'POST' }),
    onSuccess: (l) => {
      toast.success(l.archivedAt ? 'Lead archived' : 'Lead restored');
      void invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (l: Lead) => api(`${base}/leads/${l.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Lead deleted');
      setDeleting(null);
      void invalidate();
    },
  });

  const canEdit = (l: Lead) => can('records:update_any') || (can('records:update_own') && (l.assignedTo?.id === me.id || l.createdBy?.id === me.id));
  const header = (field: SortField, label: string, className?: string) => (
    <TH aria-sort={ariaSort(list.sortBy === field, list.sortDir)} className={className}>
      <SortButton label={label} active={list.sortBy === field} direction={list.sortDir} onClick={() => list.toggleSort(field)} />
    </TH>
  );

  return (
    <>
      <PageHeader
        title="Leads"
        icon={Target}
        iconTone="red"
        description="Potential customers to qualify and convert."
        actions={
          can('records:create') && (
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus /> New lead
            </Button>
          )
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-start">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search name, company, email…" className="lg:w-72 lg:shrink-0" label="Search leads" />
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-end">
            <Select aria-label="Filter by status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} className="lg:w-36">
              <EnumOptions values={LEAD_STATUSES} includeEmpty="All statuses" />
            </Select>
            <Select aria-label="Filter by priority" value={list.filters.priority} onChange={(e) => list.setFilter('priority', e.target.value)} className="lg:w-36">
              <EnumOptions values={PRIORITIES} includeEmpty="All priorities" />
            </Select>
            <Select aria-label="Filter by source" value={list.filters.source} onChange={(e) => list.setFilter('source', e.target.value)} className="lg:w-40">
              <EnumOptions values={RECORD_SOURCES} includeEmpty="All sources" />
            </Select>
            <Select aria-label="Filter by owner" value={list.filters.assignedToId} onChange={(e) => list.setFilter('assignedToId', e.target.value)} className="lg:w-44">
              <option value="">All owners</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Archived filter" value={list.filters.archived} onChange={(e) => list.setFilter('archived', e.target.value)} className="lg:w-32">
              <option value="">Active</option>
              <option value="true">Archived</option>
            </Select>
          </div>
        </div>

        {data.isPending ? (
          <TableSkeleton />
        ) : data.isError ? (
          <ErrorState error={data.error} onRetry={() => void data.refetch()} />
        ) : data.data.data.length === 0 ? (
          list.activeFilters > 0 ? (
            <EmptyState title="No leads match your filters" action={<Button variant="outline" onClick={list.resetFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={Target} title="No leads yet" description="Capture your first lead to start building pipeline." action={can('records:create') ? <Button onClick={() => setFormOpen(true)}><Plus /> New lead</Button> : undefined} />
          )
        ) : (
          <>
            <Table aria-label="Leads" className={data.isFetching ? 'opacity-70 transition-opacity' : undefined}>
              <THead>
                <tr>
                  {header('fullName', 'Name')}
                  {header('company', 'Company', 'hidden sm:table-cell')}
                  {header('status', 'Status')}
                  {header('priority', 'Priority')}
                  <TH className="hidden md:table-cell">Est. value</TH>
                  {header('nextFollowUpAt', 'Follow-up', 'hidden md:table-cell')}
                  <TH className="hidden lg:table-cell">Owner</TH>
                  <TH className="w-10">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {data.data.data.map((l) => {
                  const overdueFollowUp = l.nextFollowUpAt && new Date(l.nextFollowUpAt) < new Date() && l.status !== 'CONVERTED';
                  return (
                    <TR key={l.id}>
                      <TD>
                        <Link href={href(`/leads/${l.id}`)} className="font-medium hover:text-primary">
                          {l.fullName}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{l.jobTitle ?? l.email ?? ''}</span>
                      </TD>
                      <TD className="hidden text-muted-foreground sm:table-cell">{l.company ?? '—'}</TD>
                      <TD>
                        <StatusBadge kind="lead" value={l.status} />
                      </TD>
                      <TD>
                        <PriorityBadge value={l.priority} />
                      </TD>
                      <TD className="hidden md:table-cell">{l.estimatedValue !== null ? formatCurrency(l.estimatedValue, workspace.currency) : '—'}</TD>
                      <TD className={`hidden whitespace-nowrap md:table-cell ${overdueFollowUp ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>{formatDate(l.nextFollowUpAt)}</TD>
                      <TD className="hidden lg:table-cell">{l.assignedTo?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TD>
                      <TD>
                        <Menu>
                          <MenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${l.fullName}`}>
                              <MoreHorizontal />
                            </Button>
                          </MenuTrigger>
                          <MenuContent>
                            <MenuItem onSelect={() => router.push(href(`/leads/${l.id}`))}>
                              <Target /> View
                            </MenuItem>
                            {canEdit(l) && l.status !== 'CONVERTED' && (
                              <>
                                <MenuItem onSelect={() => setConverting(l)}>
                                  <ArrowRightLeft /> Convert to customer
                                </MenuItem>
                                <MenuItem
                                  onSelect={() => {
                                    setEditing(l);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil /> Edit
                                </MenuItem>
                              </>
                            )}
                            {canEdit(l) && (
                              <MenuItem onSelect={() => archive.mutate(l)}>
                                {l.archivedAt ? <ArchiveRestore /> : <Archive />} {l.archivedAt ? 'Restore' : 'Archive'}
                              </MenuItem>
                            )}
                            {can('records:delete_any') && (
                              <>
                                <MenuSeparator />
                                <MenuItem destructive onSelect={() => setDeleting(l)}>
                                  <Trash2 /> Delete
                                </MenuItem>
                              </>
                            )}
                          </MenuContent>
                        </Menu>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <Pagination meta={data.data.meta} onPageChange={list.setPage} />
          </>
        )}
      </Card>

      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} lead={editing} />
      {converting && <ConvertLeadDialog open onOpenChange={(open) => !open && setConverting(null)} lead={converting} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete lead?"
        description={<>This permanently deletes <strong>{deleting?.fullName}</strong> and their notes and activities.</>}
        confirmLabel="Delete lead"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
