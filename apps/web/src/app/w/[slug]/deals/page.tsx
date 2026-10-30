'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, CircleDollarSign, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Deal, Paginated } from '@crm/shared';
import { EmptyState, ErrorState, PageHeader, Pagination, SearchInput, SortButton, TableSkeleton } from '@/components/common';
import { StatusBadge } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/misc';
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/overlays';
import { DealFormDialog, usePipelines } from '@/features/deals/deal-form';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { ariaSort, useListState } from '@/hooks/use-list-state';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

type SortField = 'title' | 'value' | 'expectedCloseDate' | 'createdAt';

export default function DealsPage() {
  const { base, workspaceId, members, can, href, me } = useWorkspace();
  const client = useQueryClient();
  const pipelines = usePipelines();
  const list = useListState<{ status: string; pipelineId: string; stageId: string; assignedToId: string; minValue: string; maxValue: string; archived: string }, SortField>({
    filters: { status: '', pipelineId: '', stageId: '', assignedToId: '', minValue: '', maxValue: '', archived: '' },
    sortBy: 'createdAt',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | undefined>();
  const [deleting, setDeleting] = useState<Deal | null>(null);

  const data = useQuery({
    queryKey: wsKey(workspaceId, 'deals', 'list', list.query),
    queryFn: () => api<Paginated<Deal>>(`${base}/deals`, { query: list.query }),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => client.invalidateQueries({ queryKey: wsKey(workspaceId) });
  const archive = useMutation({
    mutationFn: (d: Deal) => api<Deal>(`${base}/deals/${d.id}/${d.archivedAt ? 'restore' : 'archive'}`, { method: 'POST' }),
    onSuccess: (d) => {
      toast.success(d.archivedAt ? 'Deal archived' : 'Deal restored');
      void invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (d: Deal) => api(`${base}/deals/${d.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Deal deleted');
      setDeleting(null);
      void invalidate();
    },
  });

  const stages = pipelines.data?.find((p) => p.id === list.filters.pipelineId)?.stages ?? pipelines.data?.flatMap((p) => p.stages) ?? [];
  const canEdit = (d: Deal) => can('records:update_any') || (can('records:update_own') && (d.assignedTo?.id === me.id || d.createdBy?.id === me.id));
  const header = (field: SortField, label: string, className?: string) => (
    <TH aria-sort={ariaSort(list.sortBy === field, list.sortDir)} className={className}>
      <SortButton label={label} active={list.sortBy === field} direction={list.sortDir} onClick={() => list.toggleSort(field)} />
    </TH>
  );
  const pageTotal = data.data?.data.reduce((sum, d) => sum + d.value, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Deals"
        description="Every opportunity across your pipelines."
        actions={
          can('records:create') && (
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus /> New deal
            </Button>
          )
        }
      />
      <Card>
        <div className="flex flex-col gap-2 border-b p-3 xl:flex-row xl:items-center">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search deals or customers…" className="xl:w-72 xl:shrink-0" label="Search deals" />
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:flex-wrap xl:justify-end">
            <Select aria-label="Filter by status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} className="xl:w-32">
              <option value="">All outcomes</option>
              <option value="OPEN">Open</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </Select>
            {pipelines.data && pipelines.data.length > 1 && (
              <Select aria-label="Filter by pipeline" value={list.filters.pipelineId} onChange={(e) => { list.setFilter('pipelineId', e.target.value); list.setFilter('stageId', ''); }} className="xl:w-40">
                <option value="">All pipelines</option>
                {pipelines.data.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            )}
            <Select aria-label="Filter by stage" value={list.filters.stageId} onChange={(e) => list.setFilter('stageId', e.target.value)} className="xl:w-40">
              <option value="">All stages</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Select aria-label="Filter by owner" value={list.filters.assignedToId} onChange={(e) => list.setFilter('assignedToId', e.target.value)} className="xl:w-40">
              <option value="">All owners</option>
              <option value="me">My deals</option>
              <option value="unassigned">Unassigned</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </Select>
            <Input aria-label="Minimum value" type="number" min={0} placeholder="Min value" value={list.filters.minValue} onChange={(e) => list.setFilter('minValue', e.target.value)} className="xl:w-28" />
            <Input aria-label="Maximum value" type="number" min={0} placeholder="Max value" value={list.filters.maxValue} onChange={(e) => list.setFilter('maxValue', e.target.value)} className="xl:w-28" />
            <Select aria-label="Archived filter" value={list.filters.archived} onChange={(e) => list.setFilter('archived', e.target.value)} className="xl:w-28">
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
            <EmptyState title="No deals match your filters" action={<Button variant="outline" onClick={list.resetFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={CircleDollarSign} title="No deals yet" description="Create a deal to start forecasting revenue." action={can('records:create') ? <Button onClick={() => setFormOpen(true)}><Plus /> New deal</Button> : undefined} />
          )
        ) : (
          <>
            <Table aria-label="Deals" className={data.isFetching ? 'opacity-70 transition-opacity' : undefined}>
              <THead>
                <tr>
                  {header('title', 'Deal')}
                  <TH>Stage</TH>
                  {header('value', 'Value')}
                  <TH className="hidden md:table-cell">Probability</TH>
                  {header('expectedCloseDate', 'Expected close', 'hidden md:table-cell')}
                  <TH className="hidden lg:table-cell">Owner</TH>
                  <TH className="w-10"><span className="sr-only">Actions</span></TH>
                </tr>
              </THead>
              <TBody>
                {data.data.data.map((d) => (
                  <TR key={d.id}>
                    <TD>
                      <Link href={href(`/deals/${d.id}`)} className="font-medium hover:text-primary">{d.title}</Link>
                      <span className="block text-xs text-muted-foreground">{d.customer?.fullName ?? 'No customer'}</span>
                    </TD>
                    <TD>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: d.stage.color }} aria-hidden />{d.stage.name}</span>
                        {d.status !== 'OPEN' && <StatusBadge kind="deal" value={d.status} />}
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap font-medium">{formatCurrency(d.value, d.currency)}</TD>
                    <TD className="hidden md:table-cell">{d.effectiveProbability}%</TD>
                    <TD className="hidden whitespace-nowrap text-muted-foreground md:table-cell">{formatDate(d.expectedCloseDate)}</TD>
                    <TD className="hidden lg:table-cell">{d.assignedTo?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TD>
                    <TD>
                      {(canEdit(d) || can('records:delete_any')) && (
                        <Menu>
                          <MenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.title}`}><MoreHorizontal /></Button>
                          </MenuTrigger>
                          <MenuContent>
                            {canEdit(d) && (
                              <>
                                <MenuItem onSelect={() => { setEditing(d); setFormOpen(true); }}><Pencil /> Edit</MenuItem>
                                <MenuItem onSelect={() => archive.mutate(d)}>{d.archivedAt ? <ArchiveRestore /> : <Archive />} {d.archivedAt ? 'Restore' : 'Archive'}</MenuItem>
                              </>
                            )}
                            {can('records:delete_any') && (
                              <>
                                <MenuSeparator />
                                <MenuItem destructive onSelect={() => setDeleting(d)}><Trash2 /> Delete</MenuItem>
                              </>
                            )}
                          </MenuContent>
                        </Menu>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">Value on this page: {formatCurrency(pageTotal)}</div>
            <Pagination meta={data.data.meta} onPageChange={list.setPage} />
          </>
        )}
      </Card>
      <DealFormDialog open={formOpen} onOpenChange={setFormOpen} deal={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete deal?"
        description={<>This permanently deletes <strong>{deleting?.title}</strong>. Linked tasks are kept.</>}
        confirmLabel="Delete deal"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
