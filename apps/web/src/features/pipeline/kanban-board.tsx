'use client';

import { useEffect, useMemo, useState, type CSSProperties, type HTMLAttributes } from 'react';
import Link from 'next/link';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, GripVertical, MoreHorizontal, MoveRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Board, Deal } from '@crm/shared';
import { Avatar } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '@/components/ui/overlays';
import { api, errorMessage } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useWorkspace, wsKey } from '@/hooks/use-workspace';
import { findContainer, moveItem, positionOf, STAGE_PREFIX, type ColumnsState } from './board-state';

function toColumns(board: Board): ColumnsState {
  return Object.fromEntries(board.columns.map((c) => [c.stage.id, c.deals.map((d) => d.id)]));
}

interface CardProps {
  deal: Deal;
  canMove: boolean;
  stages: Board['pipeline']['stages'];
  onMoveTo: (deal: Deal, stageId: string) => void;
  overlay?: boolean;
}

function DealCard(props: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.deal.id, disabled: !props.canMove });
  return (
    <DealCardBody
      {...props}
      nodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragging={isDragging}
      handleProps={{ ...attributes, ...listeners }}
    />
  );
}

interface BodyProps extends CardProps {
  nodeRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  dragging?: boolean;
  handleProps?: HTMLAttributes<HTMLButtonElement>;
}

/** Presentational card, also rendered inside the DragOverlay (which must not register a sortable). */
function DealCardBody({ deal, canMove, stages, onMoveTo, overlay, nodeRef, style, dragging, handleProps }: BodyProps) {
  const { href } = useWorkspace();
  return (
    <div
      ref={nodeRef}
      style={style}
      data-testid={overlay ? undefined : `deal-card-${deal.id}`}
      data-deal-title={overlay ? undefined : deal.title}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-3 pl-3.5 text-sm shadow-xs transition-[box-shadow,transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',
        dragging && !overlay && 'opacity-35',
        overlay && 'rotate-[2.5deg] scale-[1.02] shadow-xl ring-2 ring-primary/40',
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: deal.stage.color }} />
      <div className="flex items-start gap-2">
        {canMove && (
          <button
            type="button"
            className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100 active:cursor-grabbing"
            aria-label={`Drag ${deal.title}`}
            {...handleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <Link href={href(`/deals/${deal.id}`)} className="block font-semibold leading-snug hover:text-primary">
            {deal.title}
          </Link>
          {deal.customer && <p className="truncate text-xs text-muted-foreground">{deal.customer.company ?? deal.customer.fullName}</p>}
        </div>
        {canMove && (
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1 h-7 w-7" aria-label={`Move ${deal.title}`}>
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Move to stage</MenuLabel>
              {stages
                .filter((s) => s.id !== deal.stageId)
                .map((s) => (
                  <MenuItem key={s.id} onSelect={() => onMoveTo(deal, s.id)}>
                    <MoveRight /> {s.name}
                  </MenuItem>
                ))}
            </MenuContent>
          </Menu>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-jakarta)] text-[15px] font-bold">{formatCurrency(deal.value, deal.currency)}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {deal.expectedCloseDate && (
            <span className="flex items-center gap-1" title="Expected close date">
              <CalendarDays className="h-3 w-3" /> {formatDate(deal.expectedCloseDate, { month: 'short', day: 'numeric' })}
            </span>
          )}
          <span title={`${deal.effectiveProbability}% probability`} className="rounded-md bg-muted px-1.5 py-0.5 font-semibold">{deal.effectiveProbability}%</span>
          {deal.assignedTo && <Avatar name={deal.assignedTo.name} size="sm" />}
        </span>
      </div>
    </div>
  );
}

function Column({ column, dealIds, deals, canMove, stages, onMoveTo }: { column: Board['columns'][number]; dealIds: string[]; deals: Map<string, Deal>; canMove: (deal: Deal) => boolean; stages: Board['pipeline']['stages']; onMoveTo: CardProps['onMoveTo'] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${STAGE_PREFIX}${column.stage.id}` });
  const { workspace } = useWorkspace();
  const items = dealIds.map((id) => deals.get(id)).filter((d): d is Deal => Boolean(d));
  const total = items.reduce((sum, d) => sum + d.value, 0);
  return (
    <section
      aria-label={`${column.stage.name} stage`}
      data-testid={`stage-${column.stage.name}`}
      className="flex w-[18.5rem] shrink-0 flex-col overflow-hidden rounded-2xl border bg-subtle shadow-xs"
    >
      <header className="relative border-b bg-card px-3.5 pb-3 pt-4">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: column.stage.color }} />
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            {column.stage.name}
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: column.stage.color }}>
              {items.length}
            </span>
          </h2>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground" title="Stage probability">
            {column.stage.probability}%
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{formatCurrency(total, workspace.currency)}</span>, weighted {formatCurrency(column.weightedValue, workspace.currency)}
        </p>
      </header>
      <SortableContext id={column.stage.id} items={dealIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={cn('flex min-h-40 flex-1 flex-col gap-2 p-2.5 transition-colors duration-150', isOver && 'bg-accent/60 ring-2 ring-inset ring-primary/30')}>
          {items.map((deal) => (
            <DealCard key={deal.id} deal={deal} canMove={canMove(deal)} stages={stages} onMoveTo={onMoveTo} />
          ))}
          {items.length === 0 && (
            <p className="m-1 flex flex-1 items-center justify-center rounded-xl border-2 border-dashed py-8 text-center text-xs font-medium text-muted-foreground">Drop deals here</p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

/**
 * Drag-and-drop Kanban. Moves are applied optimistically to local state, persisted to the API
 * and rolled back (with a toast) if the server rejects them.
 */
export function KanbanBoard({ board }: { board: Board }) {
  const { base, workspaceId, can, me } = useWorkspace();
  const client = useQueryClient();
  const [columns, setColumns] = useState<ColumnsState>(() => toColumns(board));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ stageId: string; index: number } | null>(null);

  const deals = useMemo(() => new Map(board.columns.flatMap((c) => c.deals.map((d) => [d.id, d] as const))), [board]);
  // Server data is the source of truth whenever no drag is in progress.
  useEffect(() => {
    if (!activeId) setColumns(toColumns(board));
  }, [board, activeId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const canMove = (deal: Deal) => can('records:update_any') || (can('records:update_own') && (deal.assignedTo?.id === me.id || deal.createdBy?.id === me.id));

  const move = useMutation({
    mutationFn: (vars: { dealId: string; stageId: string; position: number; snapshot: ColumnsState }) =>
      api<Deal>(`${base}/deals/${vars.dealId}/move`, { method: 'POST', body: { stageId: vars.stageId, position: vars.position } }),
    meta: { silent: true },
    onError: (error, vars) => {
      setColumns(vars.snapshot);
      toast.error(`Could not move deal: ${errorMessage(error)}`);
    },
    onSuccess: (deal, vars) => {
      const stage = board.pipeline.stages.find((s) => s.id === vars.stageId);
      if (stage && stage.type !== 'OPEN') toast.success(`${deal.title} marked as ${stage.type === 'WON' ? 'won' : 'lost'}`);
    },
    onSettled: () => client.invalidateQueries({ queryKey: wsKey(workspaceId) }),
  });

  const persist = (dealId: string, next: ColumnsState, snapshot: ColumnsState) => {
    const pos = positionOf(next, dealId);
    if (!pos) return;
    setColumns(next);
    move.mutate({ dealId, stageId: pos.stageId, position: pos.index, snapshot });
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setOrigin(positionOf(columns, String(active.id)));
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeContainer = findContainer(columns, String(active.id));
    const overContainer = findContainer(columns, String(over.id));
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;
    const overIndex = String(over.id).startsWith(STAGE_PREFIX) ? columns[overContainer]!.length : columns[overContainer]!.indexOf(String(over.id));
    setColumns((prev) => moveItem(prev, String(active.id), overContainer, overIndex));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    const snapshot = toColumns(board);
    setActiveId(null);
    if (!over || !origin) {
      setColumns(snapshot);
      return;
    }
    const container = findContainer(columns, String(over.id)) ?? findContainer(columns, id);
    if (!container) return;
    let next = columns;
    if (!String(over.id).startsWith(STAGE_PREFIX) && over.id !== active.id) {
      next = moveItem(columns, id, container, columns[container]!.indexOf(String(over.id)));
    }
    const final = positionOf(next, id);
    if (!final || (final.stageId === origin.stageId && final.index === origin.index)) {
      setColumns(snapshot);
      return;
    }
    persist(id, next, snapshot);
  };

  const onMoveTo = (deal: Deal, stageId: string) => {
    const snapshot = toColumns(board);
    persist(deal.id, moveItem(snapshot, deal.id, stageId, 0), snapshot);
  };

  const activeDeal = activeId ? deals.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setColumns(toColumns(board));
      }}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up deal ${deals.get(String(active.id))?.title ?? ''}`,
          onDragOver: ({ over }) => (over ? `Over ${over.id}` : 'Not over a stage'),
          onDragEnd: ({ over }) => (over ? 'Deal dropped' : 'Drag cancelled'),
          onDragCancel: () => 'Drag cancelled',
        },
      }}
    >
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8" data-testid="kanban-board">
        {board.columns.map((column) => (
          <Column key={column.stage.id} column={column} dealIds={columns[column.stage.id] ?? []} deals={deals} canMove={canMove} stages={board.pipeline.stages} onMoveTo={onMoveTo} />
        ))}
      </div>
      <DragOverlay>{activeDeal ? <DealCardBody deal={activeDeal} canMove={false} stages={[]} onMoveTo={() => undefined} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
