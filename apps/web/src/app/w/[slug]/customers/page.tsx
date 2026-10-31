'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Building2, Copy, Download, MoreHorizontal, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { CUSTOMER_STATUSES, CUSTOMER_TYPES, humanize, RECORD_SOURCES, type Customer, type DuplicateGroup, type Paginated } from '@crm/shared';
import { EmptyState, ErrorState, PageHeader, Pagination, SearchInput, SortButton, TableSkeleton } from '@/components/common';
import { EnumOptions, StatusBadge } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Avatar, Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/misc';
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal } from '@/components/ui/overlays';
import { CustomerFormDialog } from '@/features/customers/customer-form';
import { ImportCustomersDialog } from '@/features/customers/import-dialog';
import { api, downloadFile, errorMessage } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/format';
import { ariaSort, useListState } from '@/hooks/use-list-state';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';
import { useCreateParam } from '@/hooks/use-create-param';

type SortField = 'fullName' | 'company' | 'status' | 'createdAt' | 'lastInteractionAt';

export default function CustomersPage() {
  const { base, workspaceId, members, can, hasFeature, href, me } = useWorkspace();
  const router = useRouter();
  const client = useQueryClient();
  const list = useListState<{ status: string; type: string; source: string; assignedToId: string; archived: string }, SortField>({
    filters: { status: '', type: '', source: '', assignedToId: '', archived: '' },
    sortBy: 'createdAt',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [exporting, setExporting] = useState(false);
  const openCreate = useCallback(() => {
    setEditing(undefined);
    setFormOpen(true);
  }, []);
  useCreateParam(openCreate, can('records:create'));

  const data = useQuery({
    queryKey: wsKey(workspaceId, 'customers', 'list', list.query),
    queryFn: () => api<Paginated<Customer>>(`${base}/customers`, { query: list.query }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => client.invalidateQueries({ queryKey: wsKey(workspaceId, 'customers') });
  const archive = useMutation({
    mutationFn: (c: Customer) => api<Customer>(`${base}/customers/${c.id}/${c.archivedAt ? 'restore' : 'archive'}`, { method: 'POST' }),
    onSuccess: (c) => {
      toast.success(c.archivedAt ? 'Customer archived' : 'Customer restored');
      void invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (c: Customer) => api(`${base}/customers/${c.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Customer deleted');
      setDeleting(null);
      void invalidate();
    },
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { page: _page, pageSize: _size, ...filters } = list.query;
      await downloadFile(`${base}/customers/export`, `customers-${new Date().toISOString().slice(0, 10)}.csv`, filters);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const canEdit = (c: Customer) => can('records:update_any') || (can('records:update_own') && (c.assignedTo?.id === me.id || c.createdBy?.id === me.id));
  const header = (field: SortField, label: string) => (
    <TH aria-sort={ariaSort(list.sortBy === field, list.sortDir)}>
      <SortButton label={label} active={list.sortBy === field} direction={list.sortDir} onClick={() => list.toggleSort(field)} />
    </TH>
  );

  return (
    <>
      <PageHeader
        title="Customers"
        icon={Building2}
        iconTone="green"
        description="People and companies you do business with."
        actions={
          <>
            <Button variant="outline" onClick={() => setDuplicatesOpen(true)}>
              <Copy /> Duplicates
            </Button>
            {can('records:export') && (
              <Button variant="outline" onClick={exportCsv} loading={exporting}>
                <Download /> Export
              </Button>
            )}
            {can('records:import') && (
              <Button
                variant="outline"
                onClick={() => (hasFeature('csv_import') ? setImportOpen(true) : toast.info('CSV import is available on the Starter plan and above.', { action: { label: 'View plans', onClick: () => router.push(href('/settings/billing')) } }))}
              >
                <Upload /> Import
              </Button>
            )}
            {can('records:create') && (
              <Button
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus /> New customer
              </Button>
            )}
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-start">
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search name, company, email, phone…" className="lg:w-72 lg:shrink-0" label="Search customers" />
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-end">
            <Select aria-label="Filter by status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} className="lg:w-36">
              <EnumOptions values={CUSTOMER_STATUSES} includeEmpty="All statuses" />
            </Select>
            <Select aria-label="Filter by type" value={list.filters.type} onChange={(e) => list.setFilter('type', e.target.value)} className="lg:w-36">
              <EnumOptions values={CUSTOMER_TYPES} includeEmpty="All types" />
            </Select>
            <Select aria-label="Filter by source" value={list.filters.source} onChange={(e) => list.setFilter('source', e.target.value)} className="lg:w-40">
              <EnumOptions values={RECORD_SOURCES} includeEmpty="All sources" />
            </Select>
            <Select aria-label="Filter by representative" value={list.filters.assignedToId} onChange={(e) => list.setFilter('assignedToId', e.target.value)} className="lg:w-44">
              <option value="">All representatives</option>
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
            <EmptyState title="No customers match your filters" description="Try a different search or clear the filters." action={<Button variant="outline" onClick={list.resetFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState
              icon={Building2}
              title="No customers yet"
              description="Add your first customer or import a CSV to get started."
              action={can('records:create') ? <Button onClick={() => setFormOpen(true)}><Plus /> New customer</Button> : undefined}
            />
          )
        ) : (
          <>
            <Table aria-label="Customers" className={data.isFetching ? 'opacity-70 transition-opacity' : undefined}>
              <THead>
                <tr>
                  {header('fullName', 'Name')}
                  {header('company', 'Company')}
                  {header('status', 'Status')}
                  <TH className="hidden md:table-cell">Representative</TH>
                  {header('lastInteractionAt', 'Last interaction')}
                  {header('createdAt', 'Created')}
                  <TH className="w-10">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {data.data.data.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={href(`/customers/${c.id}`)} className="group flex items-center gap-3">
                        <Avatar name={c.fullName} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium group-hover:text-primary">{c.fullName}</span>
                          <span className="block truncate text-xs text-muted-foreground">{c.email ?? c.phone ?? humanize(c.type)}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">{c.company ?? '—'}</TD>
                    <TD>
                      <StatusBadge kind="customer" value={c.status} />
                    </TD>
                    <TD className="hidden md:table-cell">{c.assignedTo ? <span className="text-sm">{c.assignedTo.name}</span> : <span className="text-muted-foreground">Unassigned</span>}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{c.lastInteractionAt ? formatRelative(c.lastInteractionAt) : 'Never'}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{formatDate(c.createdAt)}</TD>
                    <TD>
                      <Menu>
                        <MenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.fullName}`}>
                            <MoreHorizontal />
                          </Button>
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem onSelect={() => router.push(href(`/customers/${c.id}`))}>
                            <Building2 /> View
                          </MenuItem>
                          {canEdit(c) && (
                            <>
                              <MenuItem
                                onSelect={() => {
                                  setEditing(c);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil /> Edit
                              </MenuItem>
                              <MenuItem onSelect={() => archive.mutate(c)}>
                                {c.archivedAt ? <ArchiveRestore /> : <Archive />} {c.archivedAt ? 'Restore' : 'Archive'}
                              </MenuItem>
                            </>
                          )}
                          {can('records:delete_any') && (
                            <>
                              <MenuSeparator />
                              <MenuItem destructive onSelect={() => setDeleting(c)}>
                                <Trash2 /> Delete
                              </MenuItem>
                            </>
                          )}
                        </MenuContent>
                      </Menu>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination meta={data.data.meta} onPageChange={list.setPage} />
          </>
        )}
      </Card>

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} customer={editing} />
      <ImportCustomersDialog open={importOpen} onOpenChange={setImportOpen} />
      <DuplicatesDialog open={duplicatesOpen} onOpenChange={setDuplicatesOpen} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete customer?"
        description={
          <>
            <strong>{deleting?.fullName}</strong> and their notes and activities will be permanently deleted. Linked deals and tasks are kept but unlinked. Consider archiving instead.
          </>
        }
        confirmLabel="Delete customer"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}

function DuplicatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { base, workspaceId, href } = useWorkspace();
  const data = useQuery({
    queryKey: wsKey(workspaceId, 'customers', 'duplicates'),
    queryFn: () => api<DuplicateGroup[]>(`${base}/customers/duplicates`),
    enabled: open,
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Potential duplicates" description="Customers sharing a phone number or the same name and company." size="lg">
      {data.isPending ? (
        <TableSkeleton rows={3} columns={3} />
      ) : data.isError ? (
        <ErrorState error={data.error} onRetry={() => void data.refetch()} />
      ) : data.data.length === 0 ? (
        <EmptyState icon={Copy} title="No duplicates found" description="Your customer list looks clean." />
      ) : (
        <ul className="space-y-3">
          {data.data.map((group) => (
            <li key={`${group.reason}-${group.value}`} className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {group.reason === 'phone' ? 'Same phone number' : 'Same name and company'}: <span className="text-foreground">{group.value}</span>
              </p>
              <ul className="space-y-1">
                {group.customers.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={href(`/customers/${c.id}`)} className="font-medium hover:text-primary" onClick={() => onOpenChange(false)}>
                      {c.fullName}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">
                      {[c.company, c.email, c.phone].filter(Boolean).join(', ')}, added {formatDate(c.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
