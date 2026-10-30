'use client';

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { KanbanSquare, Plus, Settings2 } from 'lucide-react';
import type { Board } from '@crm/shared';
import { EmptyState, ErrorState, PageHeader, SearchInput } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Card, Skeleton } from '@/components/ui/misc';
import { DealFormDialog, usePipelines } from '@/features/deals/deal-form';
import { KanbanBoard } from '@/features/pipeline/kanban-board';
import { StageManagerDialog } from '@/features/pipeline/stage-manager';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useDebounce } from '@/hooks/use-debounce';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';

export default function PipelinePage() {
  const { base, workspaceId, can, members, workspace } = useWorkspace();
  const pipelines = usePipelines();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const [dealOpen, setDealOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const q = useDebounce(search.trim(), 300);

  const pipeline = pipelines.data?.find((p) => p.id === selected) ?? pipelines.data?.[0];
  const board = useQuery({
    queryKey: wsKey(workspaceId, 'board', pipeline?.id, q, owner),
    queryFn: () => api<Board>(`${base}/pipelines/${pipeline!.id}/board`, { query: { q: q || undefined, assignedToId: owner || undefined } }),
    enabled: Boolean(pipeline),
    placeholderData: keepPreviousData,
  });

  const totals = board.data?.totals;

  return (
    <>
      <PageHeader
        title="Sales pipeline"
        description="Drag deals between stages. Changes save automatically."
        actions={
          <>
            {can('pipelines:manage') && pipeline && (
              <Button variant="outline" onClick={() => setManageOpen(true)}>
                <Settings2 /> Manage stages
              </Button>
            )}
            {can('records:create') && (
              <Button onClick={() => setDealOpen(true)} disabled={!pipeline}>
                <Plus /> New deal
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Open pipeline', totals ? formatCurrency(totals.openValue, workspace.currency) : null],
          ['Weighted forecast', totals ? formatCurrency(totals.weightedValue, workspace.currency) : null],
          ['Open deals', totals ? String(totals.openDeals) : null],
          ['Won (this pipeline)', totals ? formatCurrency(totals.wonValue, workspace.currency) : null],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            {value === null ? <Skeleton className="mt-2 h-6 w-24" /> : <p className="mt-1 text-xl font-semibold" data-testid={`total-${label}`}>{value}</p>}
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {pipelines.data && pipelines.data.length > 1 && (
          <Select aria-label="Pipeline" value={pipeline?.id ?? ''} onChange={(e) => setSelected(e.target.value)} className="sm:w-56">
            {pipelines.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </Select>
        )}
        <SearchInput value={search} onChange={setSearch} placeholder="Filter deals…" className="sm:w-72" label="Filter deals" />
        <Select aria-label="Filter by owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="sm:w-48">
          <option value="">All owners</option>
          <option value="me">My deals</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.user.id} value={m.user.id}>
              {m.user.name}
            </option>
          ))}
        </Select>
      </div>

      {pipelines.isError ? (
        <ErrorState error={pipelines.error} onRetry={() => void pipelines.refetch()} />
      ) : !pipeline && pipelines.isSuccess ? (
        <EmptyState icon={KanbanSquare} title="No pipeline yet" />
      ) : board.isError ? (
        <ErrorState error={board.error} onRetry={() => void board.refetch()} />
      ) : !board.data ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : (
        <KanbanBoard board={board.data} />
      )}

      <DealFormDialog open={dealOpen} onOpenChange={setDealOpen} defaults={{ pipelineId: pipeline?.id }} />
      {pipeline && pipelines.data && manageOpen && <StageManagerDialog open onOpenChange={setManageOpen} pipeline={pipeline} pipelines={pipelines.data} onSelectPipeline={setSelected} />}
    </>
  );
}
