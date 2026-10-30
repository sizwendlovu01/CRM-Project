import { Injectable } from '@nestjs/common';
import { Prisma, StageType } from '@prisma/client';
import type { Board, CreateDealInput, Deal, DealListQuery, MoveDealInput, Paginated, UpdateDealInput } from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceRefsService } from '../../database/workspace-refs.service';
import { AppException } from '../../common/errors';
import { assigneeFilter, pageArgs, paginated } from '../../common/pagination';
import { assertAssigneeChange, assertCanModify, resolveAssigneeForCreate } from '../../common/record-access';
import type { WorkspaceContext } from '../../common/types';
import { AuditService } from '../audit-logs/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanLimitsService } from '../subscriptions/plan-limits.service';
import { PipelinesService } from '../pipelines/pipelines.service';
import { dealInclude, toDeal, weightedValue, type DealRow } from './deals.mapper';

function statusForStage(type: StageType) {
  return { status: type, closedAt: type === 'OPEN' ? null : new Date() };
}

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: WorkspaceRefsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly limits: PlanLimitsService,
    private readonly pipelines: PipelinesService,
  ) {}

  private searchFilter(q: string | undefined): Prisma.DealWhereInput {
    if (!q) return {};
    const contains = { contains: q, mode: 'insensitive' as const };
    return { OR: [{ title: contains }, { customer: { fullName: contains } }, { customer: { company: contains } }] };
  }

  async list(ctx: WorkspaceContext, query: DealListQuery): Promise<Paginated<Deal>> {
    const where: Prisma.DealWhereInput = {
      workspaceId: ctx.workspaceId,
      archivedAt: query.archived ? { not: null } : null,
      ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}),
      ...(query.stageId ? { stageId: query.stageId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...assigneeFilter(query.assignedToId, ctx.userId),
      ...(query.minValue !== undefined || query.maxValue !== undefined
        ? { value: { ...(query.minValue !== undefined ? { gte: query.minValue } : {}), ...(query.maxValue !== undefined ? { lte: query.maxValue } : {}) } }
        : {}),
      ...this.searchFilter(query.q),
    };
    const orderBy: Prisma.DealOrderByWithRelationInput[] = [
      query.sortBy === 'expectedCloseDate' ? { expectedCloseDate: { sort: query.sortDir, nulls: 'last' } } : { [query.sortBy]: query.sortDir },
      { id: 'asc' },
    ];
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.deal.findMany({ where, orderBy, include: dealInclude, ...pageArgs(query.page, query.pageSize) }),
      this.prisma.deal.count({ where }),
    ]);
    return paginated(rows.map((r) => toDeal(r, ctx.currency)), total, query.page, query.pageSize);
  }

  /** Kanban board for one pipeline: stages with ordered deals and value totals. */
  async board(ctx: WorkspaceContext, pipelineId: string, query: { q?: string; assignedToId?: string }): Promise<Board> {
    const pipeline = await this.pipelines.get(ctx, pipelineId);
    const rows = await this.prisma.deal.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        pipelineId,
        archivedAt: null,
        ...assigneeFilter(query.assignedToId, ctx.userId),
        ...this.searchFilter(query.q),
      },
      include: dealInclude,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const deals = rows.map((r) => toDeal(r, ctx.currency));

    const columns = pipeline.stages.map((stage) => {
      const stageDeals = deals.filter((d) => d.stageId === stage.id);
      const totalValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
      const weighted = stageDeals.reduce((sum, d) => sum + weightedValue(d.value, d.effectiveProbability), 0);
      return { stage, deals: stageDeals, totalValue, weightedValue: Math.round(weighted * 100) / 100 };
    });
    const open = deals.filter((d) => d.status === 'OPEN');
    return {
      pipeline,
      columns,
      totals: {
        openDeals: open.length,
        openValue: open.reduce((sum, d) => sum + d.value, 0),
        weightedValue: Math.round(open.reduce((sum, d) => sum + weightedValue(d.value, d.effectiveProbability), 0) * 100) / 100,
        wonValue: deals.filter((d) => d.status === 'WON').reduce((sum, d) => sum + d.value, 0),
      },
    };
  }

  private async findOrThrow(ctx: WorkspaceContext, id: string): Promise<DealRow> {
    const deal = await this.prisma.deal.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: dealInclude });
    if (!deal) throw AppException.notFound('Deal');
    return deal;
  }

  async get(ctx: WorkspaceContext, id: string): Promise<Deal> {
    return toDeal(await this.findOrThrow(ctx, id), ctx.currency);
  }

  private async notifyAssigned(ctx: WorkspaceContext, deal: DealRow) {
    if (!deal.assignedToId) return;
    await this.notifications.notify({
      userId: deal.assignedToId,
      workspaceId: ctx.workspaceId,
      type: 'DEAL_ASSIGNED',
      title: `Deal assigned to you: ${deal.title}`,
      body: `Value ${deal.value.toNumber().toLocaleString('en-US')} ${ctx.currency}`,
      link: `/w/${ctx.workspaceSlug}/deals/${deal.id}`,
      actorId: ctx.userId,
    });
  }

  private async notifyUpdated(ctx: WorkspaceContext, deal: DealRow, change: string) {
    if (!deal.assignedToId) return;
    await this.notifications.notify({
      userId: deal.assignedToId,
      workspaceId: ctx.workspaceId,
      type: 'DEAL_UPDATED',
      title: `Deal updated: ${deal.title}`,
      body: change,
      link: `/w/${ctx.workspaceSlug}/deals/${deal.id}`,
      actorId: ctx.userId,
    });
  }

  async create(ctx: WorkspaceContext, input: CreateDealInput): Promise<Deal> {
    const stage = await this.refs.getStage(ctx.workspaceId, input.stageId, input.pipelineId);
    const assignedToId = resolveAssigneeForCreate(ctx, input.assignedToId);
    await this.refs.assertMember(ctx.workspaceId, assignedToId);
    await this.refs.assertCustomer(ctx.workspaceId, input.customerId);
    await this.limits.assertWithinLimit(ctx.workspaceId, ctx.plan, 'deals');

    const deal = await this.prisma.$transaction(async (tx) => {
      const position = await tx.deal.count({ where: { stageId: stage.id, archivedAt: null } });
      return tx.deal.create({
        data: {
          workspaceId: ctx.workspaceId,
          pipelineId: input.pipelineId,
          stageId: stage.id,
          title: input.title,
          value: input.value,
          probability: input.probability ?? null,
          expectedCloseDate: input.expectedCloseDate ?? null,
          description: input.description ?? null,
          lostReason: input.lostReason ?? null,
          customerId: input.customerId ?? null,
          assignedToId,
          createdById: ctx.userId,
          position,
          ...statusForStage(stage.type),
        },
        include: dealInclude,
      });
    });
    await this.notifyAssigned(ctx, deal);
    await this.audit.log(ctx, { action: 'deal.created', entityType: 'deal', entityId: deal.id, metadata: { title: deal.title, value: input.value } });
    return toDeal(deal, ctx.currency);
  }

  async update(ctx: WorkspaceContext, id: string, input: UpdateDealInput): Promise<Deal> {
    const existing = await this.findOrThrow(ctx, id);
    assertCanModify(ctx, existing);
    const reassigned = assertAssigneeChange(ctx, existing.assignedToId, input.assignedToId);
    if (reassigned) await this.refs.assertMember(ctx.workspaceId, input.assignedToId);
    if (input.customerId !== undefined) await this.refs.assertCustomer(ctx.workspaceId, input.customerId);

    const updated = await this.prisma.deal.update({ where: { id }, data: input, include: dealInclude });

    if (reassigned) await this.notifyAssigned(ctx, updated);
    else if (input.value !== undefined && !existing.value.equals(updated.value)) {
      await this.notifyUpdated(ctx, updated, `Value changed to ${updated.value.toNumber().toLocaleString('en-US')} ${ctx.currency}`);
    }
    await this.audit.log(ctx, { action: 'deal.updated', entityType: 'deal', entityId: id, metadata: { fields: Object.keys(input) } });
    return toDeal(updated, ctx.currency);
  }

  /**
   * Moves a deal to a stage/position. Stage rows are locked so concurrent drags cannot
   * corrupt the ordering, and positions in both columns are compacted.
   */
  async move(ctx: WorkspaceContext, id: string, input: MoveDealInput): Promise<Deal> {
    const existing = await this.findOrThrow(ctx, id);
    assertCanModify(ctx, existing);
    if (existing.archivedAt) throw AppException.badRequest('DEAL_ARCHIVED', 'Restore the deal before moving it.');
    const target = await this.refs.getStage(ctx.workspaceId, input.stageId, existing.pipelineId);

    const moved = await this.prisma.$transaction(async (tx) => {
      const stageIds = [...new Set([existing.stageId, target.id])].sort();
      await tx.$queryRaw`SELECT id FROM stages WHERE id IN (${Prisma.join(stageIds.map((s) => Prisma.sql`${s}::uuid`))}) ORDER BY id FOR UPDATE`;

      const targetDeals = await tx.deal.findMany({
        where: { stageId: target.id, archivedAt: null, NOT: { id } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      const index = Math.min(input.position ?? targetDeals.length, targetDeals.length);
      const ordered = [...targetDeals.slice(0, index).map((d) => d.id), id, ...targetDeals.slice(index).map((d) => d.id)];

      const stageChanged = target.id !== existing.stageId;
      await tx.deal.update({
        where: { id },
        data: { stageId: target.id, ...(stageChanged ? statusForStage(target.type) : {}) },
      });
      for (const [position, dealId] of ordered.entries()) {
        await tx.deal.update({ where: { id: dealId }, data: { position } });
      }
      if (stageChanged) {
        const source = await tx.deal.findMany({
          where: { stageId: existing.stageId, archivedAt: null },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: { id: true },
        });
        for (const [position, deal] of source.entries()) {
          await tx.deal.update({ where: { id: deal.id }, data: { position } });
        }
      }
      return tx.deal.findUniqueOrThrow({ where: { id }, include: dealInclude });
    });

    if (target.id !== existing.stageId) {
      await this.notifyUpdated(ctx, moved, `Moved from ${existing.stage.name} to ${target.name}`);
      await this.audit.log(ctx, {
        action: 'deal.stage_changed',
        entityType: 'deal',
        entityId: id,
        metadata: { from: existing.stage.name, to: target.name },
      });
    }
    return toDeal(moved, ctx.currency);
  }

  async setArchived(ctx: WorkspaceContext, id: string, archived: boolean): Promise<Deal> {
    const existing = await this.findOrThrow(ctx, id);
    assertCanModify(ctx, existing);
    const updated = await this.prisma.deal.update({ where: { id }, data: { archivedAt: archived ? new Date() : null }, include: dealInclude });
    await this.audit.log(ctx, { action: archived ? 'deal.archived' : 'deal.restored', entityType: 'deal', entityId: id });
    return toDeal(updated, ctx.currency);
  }

  async remove(ctx: WorkspaceContext, id: string): Promise<void> {
    const existing = await this.findOrThrow(ctx, id);
    await this.prisma.deal.delete({ where: { id } });
    await this.audit.log(ctx, { action: 'deal.deleted', entityType: 'deal', entityId: id, metadata: { title: existing.title } });
  }
}
