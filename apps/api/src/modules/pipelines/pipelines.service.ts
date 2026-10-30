import { Injectable } from '@nestjs/common';
import type { Pipeline, Stage } from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../../common/errors';
import type { WorkspaceContext } from '../../common/types';
import { AuditService } from '../audit-logs/audit.service';
import { PlanLimitsService } from '../subscriptions/plan-limits.service';
import { DEFAULT_STAGES } from '../workspaces/workspace-factory';

type StageRow = { id: string; pipelineId: string; name: string; position: number; probability: number; type: Stage['type']; color: string };

function toStage(row: StageRow, dealCount?: number): Stage {
  return {
    id: row.id,
    pipelineId: row.pipelineId,
    name: row.name,
    position: row.position,
    probability: row.probability,
    type: row.type,
    color: row.color,
    ...(dealCount === undefined ? {} : { dealCount }),
  };
}

@Injectable()
export class PipelinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly limits: PlanLimitsService,
  ) {}

  async list(ctx: WorkspaceContext): Promise<Pipeline[]> {
    const pipelines = await this.prisma.pipeline.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { stages: { orderBy: { position: 'asc' }, include: { _count: { select: { deals: { where: { archivedAt: null } } } } } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      createdAt: p.createdAt.toISOString(),
      stages: p.stages.map((s) => toStage(s, s._count.deals)),
    }));
  }

  async get(ctx: WorkspaceContext, id: string): Promise<Pipeline> {
    const pipeline = (await this.list(ctx)).find((p) => p.id === id);
    if (!pipeline) throw AppException.notFound('Pipeline');
    return pipeline;
  }

  async create(ctx: WorkspaceContext, name: string): Promise<Pipeline> {
    await this.limits.assertWithinLimit(ctx.workspaceId, ctx.plan, 'pipelines');
    const hasDefault = await this.prisma.pipeline.count({ where: { workspaceId: ctx.workspaceId, isDefault: true } });
    const pipeline = await this.prisma.pipeline.create({
      data: {
        workspaceId: ctx.workspaceId,
        name,
        isDefault: hasDefault === 0,
        stages: { create: DEFAULT_STAGES.map((stage, position) => ({ ...stage, position, workspaceId: ctx.workspaceId })) },
      },
    });
    await this.audit.log(ctx, { action: 'pipeline.created', entityType: 'pipeline', entityId: pipeline.id, metadata: { name } });
    return this.get(ctx, pipeline.id);
  }

  private async findOrThrow(ctx: WorkspaceContext, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (!pipeline) throw AppException.notFound('Pipeline');
    return pipeline;
  }

  async update(ctx: WorkspaceContext, id: string, input: { name?: string; isDefault?: boolean }): Promise<Pipeline> {
    const pipeline = await this.findOrThrow(ctx, id);
    if (input.isDefault === false && pipeline.isDefault) {
      throw AppException.badRequest('DEFAULT_REQUIRED', 'Make another pipeline the default instead.');
    }
    await this.prisma.$transaction(async (tx) => {
      if (input.isDefault && !pipeline.isDefault) {
        await tx.pipeline.updateMany({ where: { workspaceId: ctx.workspaceId, isDefault: true }, data: { isDefault: false } });
      }
      await tx.pipeline.update({ where: { id }, data: { ...(input.name ? { name: input.name } : {}), ...(input.isDefault ? { isDefault: true } : {}) } });
    });
    await this.audit.log(ctx, { action: 'pipeline.updated', entityType: 'pipeline', entityId: id, metadata: input });
    return this.get(ctx, id);
  }

  async remove(ctx: WorkspaceContext, id: string): Promise<void> {
    const pipeline = await this.findOrThrow(ctx, id);
    if (pipeline.isDefault) throw AppException.badRequest('DEFAULT_PIPELINE', 'The default pipeline cannot be deleted.');
    const deals = await this.prisma.deal.count({ where: { pipelineId: id } });
    if (deals > 0) {
      throw AppException.conflict('PIPELINE_NOT_EMPTY', `This pipeline still contains ${deals} deal(s). Move or delete them first.`);
    }
    await this.prisma.pipeline.delete({ where: { id } });
    await this.audit.log(ctx, { action: 'pipeline.deleted', entityType: 'pipeline', entityId: id, metadata: { name: pipeline.name } });
  }

  /* ------------------------------- Stages ------------------------------- */

  async createStage(ctx: WorkspaceContext, pipelineId: string, input: { name: string; probability: number; type: Stage['type']; color?: string }) {
    await this.findOrThrow(ctx, pipelineId);
    const last = await this.prisma.stage.findFirst({ where: { pipelineId }, orderBy: { position: 'desc' }, select: { position: true } });
    const count = await this.prisma.stage.count({ where: { pipelineId } });
    if (count >= 20) throw AppException.badRequest('STAGE_LIMIT', 'A pipeline can have at most 20 stages.');
    const stage = await this.prisma.stage.create({
      data: { ...input, pipelineId, workspaceId: ctx.workspaceId, position: (last?.position ?? -1) + 1 },
    });
    await this.audit.log(ctx, { action: 'stage.created', entityType: 'stage', entityId: stage.id, metadata: { name: input.name } });
    return toStage(stage, 0);
  }

  async updateStage(
    ctx: WorkspaceContext,
    pipelineId: string,
    stageId: string,
    input: { name?: string; probability?: number; type?: Stage['type']; color?: string },
  ) {
    const stage = await this.prisma.stage.findFirst({ where: { id: stageId, pipelineId, workspaceId: ctx.workspaceId } });
    if (!stage) throw AppException.notFound('Stage');
    if (input.type && input.type !== stage.type && stage.type === 'OPEN') {
      const openStages = await this.prisma.stage.count({ where: { pipelineId, type: 'OPEN' } });
      if (openStages <= 1) throw AppException.badRequest('OPEN_STAGE_REQUIRED', 'A pipeline needs at least one open stage.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.stage.update({ where: { id: stageId }, data: input });
      // Keep deal outcomes consistent with the stage type.
      if (input.type && input.type !== stage.type) {
        await tx.deal.updateMany({
          where: { stageId },
          data: { status: input.type, closedAt: input.type === 'OPEN' ? null : new Date() },
        });
      }
      return result;
    });
    await this.audit.log(ctx, { action: 'stage.updated', entityType: 'stage', entityId: stageId, metadata: input });
    return toStage(updated);
  }

  async reorderStages(ctx: WorkspaceContext, pipelineId: string, stageIds: string[]): Promise<Pipeline> {
    await this.findOrThrow(ctx, pipelineId);
    const stages = await this.prisma.stage.findMany({ where: { pipelineId }, select: { id: true } });
    const current = new Set(stages.map((s) => s.id));
    if (stageIds.length !== current.size || new Set(stageIds).size !== stageIds.length || stageIds.some((id) => !current.has(id))) {
      throw AppException.badRequest('INVALID_ORDER', 'Provide every stage of the pipeline exactly once.');
    }
    await this.prisma.$transaction(stageIds.map((id, position) => this.prisma.stage.update({ where: { id }, data: { position } })));
    return this.get(ctx, pipelineId);
  }

  /** Deletes a stage. Deals in the stage must be moved to another stage of the same pipeline. */
  async removeStage(ctx: WorkspaceContext, pipelineId: string, stageId: string, moveDealsToStageId?: string): Promise<void> {
    const stage = await this.prisma.stage.findFirst({ where: { id: stageId, pipelineId, workspaceId: ctx.workspaceId } });
    if (!stage) throw AppException.notFound('Stage');
    const stageCount = await this.prisma.stage.count({ where: { pipelineId } });
    if (stageCount <= 1) throw AppException.badRequest('LAST_STAGE', 'A pipeline must keep at least one stage.');
    if (stage.type === 'OPEN') {
      const openStages = await this.prisma.stage.count({ where: { pipelineId, type: 'OPEN' } });
      if (openStages <= 1) throw AppException.badRequest('OPEN_STAGE_REQUIRED', 'A pipeline needs at least one open stage.');
    }

    const dealCount = await this.prisma.deal.count({ where: { stageId } });
    let target: { id: string; type: Stage['type'] } | null = null;
    if (dealCount > 0) {
      if (!moveDealsToStageId) {
        throw AppException.conflict('STAGE_NOT_EMPTY', `This stage contains ${dealCount} deal(s). Choose a stage to move them to.`);
      }
      target = await this.prisma.stage.findFirst({
        where: { id: moveDealsToStageId, pipelineId, workspaceId: ctx.workspaceId, NOT: { id: stageId } },
        select: { id: true, type: true },
      });
      if (!target) throw AppException.invalidReference('moveDealsToStageId', 'Target stage not found in this pipeline');
    }

    await this.prisma.$transaction(async (tx) => {
      if (target) {
        const offset = await tx.deal.count({ where: { stageId: target.id } });
        const deals = await tx.deal.findMany({ where: { stageId }, orderBy: { position: 'asc' }, select: { id: true } });
        for (const [index, deal] of deals.entries()) {
          await tx.deal.update({
            where: { id: deal.id },
            data: {
              stageId: target.id,
              position: offset + index,
              status: target.type,
              ...(target.type === 'OPEN' ? { closedAt: null } : {}),
            },
          });
        }
      }
      await tx.stage.delete({ where: { id: stageId } });
      const remaining = await tx.stage.findMany({ where: { pipelineId }, orderBy: { position: 'asc' }, select: { id: true } });
      for (const [position, s] of remaining.entries()) {
        await tx.stage.update({ where: { id: s.id }, data: { position } });
      }
    });
    await this.audit.log(ctx, { action: 'stage.deleted', entityType: 'stage', entityId: stageId, metadata: { name: stage.name, movedDeals: dealCount } });
  }
}
