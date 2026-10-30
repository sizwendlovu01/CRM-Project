import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hasPermission, type AnalyticsOverview, type RepPerformance, type TimeSeriesPoint } from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import type { WorkspaceContext } from '../../common/types';

export type Granularity = 'day' | 'week' | 'month';

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 3 * 366;

export function pickGranularity(from: Date, to: Date): Granularity {
  const days = (to.getTime() - from.getTime()) / DAY_MS;
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

/** Normalises the requested range: defaults to the last 30 days and caps very long ranges. */
export function resolveRange(from?: Date, to?: Date): { from: Date; to: Date } {
  const end = to ?? new Date();
  let start = from ?? new Date(end.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) start = new Date(end.getTime() - MAX_RANGE_DAYS * DAY_MS);
  return { from: start, to: end };
}

/**
 * Columns are UTC `timestamp without time zone`. Pass bounds as zone-less ISO text so the
 * comparison never depends on the database session TimeZone.
 */
const tsSql = (date: Date) => Prisma.sql`${date.toISOString().replace('Z', '')}::timestamp`;

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (num: number, den: number) => (den === 0 ? 0 : Math.round((num / den) * 1000) / 10);

/**
 * Business intelligence queries. Every figure is computed from live database rows scoped to the
 * workspace. Sales representatives see figures for their own records only.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(ctx: WorkspaceContext, range: { from?: Date; to?: Date }): Promise<AnalyticsOverview> {
    const { from, to } = resolveRange(range.from, range.to);
    const granularity = pickGranularity(from, to);
    const ws = ctx.workspaceId;
    const own = ctx.role === 'SALES_REPRESENTATIVE' ? ctx.userId : null;
    const assigned = own ? { assignedToId: own } : {};
    const inRange = { gte: from, lte: to };
    const now = new Date();

    const [
      totalCustomers,
      newCustomers,
      totalLeads,
      newLeads,
      qualifiedLeads,
      convertedOfNew,
      convertedLeads,
      openDeals,
      won,
      lost,
      completedTasks,
      overdueTasks,
      openTasks,
      activities,
    ] = await this.prisma.$transaction([
      this.prisma.customer.count({ where: { workspaceId: ws, archivedAt: null, ...assigned } }),
      this.prisma.customer.count({ where: { workspaceId: ws, createdAt: inRange, ...assigned } }),
      this.prisma.lead.count({ where: { workspaceId: ws, archivedAt: null, ...assigned } }),
      this.prisma.lead.count({ where: { workspaceId: ws, createdAt: inRange, ...assigned } }),
      this.prisma.lead.count({ where: { workspaceId: ws, archivedAt: null, status: 'QUALIFIED', ...assigned } }),
      this.prisma.lead.count({ where: { workspaceId: ws, createdAt: inRange, status: 'CONVERTED', ...assigned } }),
      this.prisma.lead.count({ where: { workspaceId: ws, convertedAt: inRange, ...assigned } }),
      this.prisma.deal.aggregate({ where: { workspaceId: ws, status: 'OPEN', archivedAt: null, ...assigned }, _count: true, _sum: { value: true } }),
      this.prisma.deal.aggregate({ where: { workspaceId: ws, status: 'WON', closedAt: inRange, ...assigned }, _count: true, _sum: { value: true } }),
      this.prisma.deal.count({ where: { workspaceId: ws, status: 'LOST', closedAt: inRange, ...assigned } }),
      this.prisma.task.count({ where: { workspaceId: ws, status: 'COMPLETED', completedAt: inRange, ...assigned } }),
      this.prisma.task.count({ where: { workspaceId: ws, status: { in: ['TODO', 'IN_PROGRESS'] }, dueAt: { lt: now }, ...assigned } }),
      this.prisma.task.count({ where: { workspaceId: ws, status: { in: ['TODO', 'IN_PROGRESS'] }, ...assigned } }),
      this.prisma.activity.count({ where: { workspaceId: ws, occurredAt: inRange, ...(own ? { userId: own } : {}) } }),
    ]);

    const ownDeal = own ? Prisma.sql`AND d."assignedToId" = ${own}::uuid` : Prisma.empty;
    const [weighted] = await this.prisma.$queryRaw<{ weighted: number | null }[]>`
      SELECT COALESCE(SUM(d.value * COALESCE(d.probability, s.probability) / 100.0), 0)::float8 AS weighted
      FROM deals d JOIN stages s ON s.id = d."stageId"
      WHERE d."workspaceId" = ${ws}::uuid AND d.status = 'OPEN' AND d."archivedAt" IS NULL ${ownDeal}`;

    const [revenueByPeriod, customersByPeriod, activitiesByPeriod, leadConversionByPeriod] = await Promise.all([
      this.series(granularity, from, to, Prisma.sql`
        SELECT date_trunc(${granularity}, d."closedAt") AS bucket, SUM(d.value)::float8 AS value
        FROM deals d WHERE d."workspaceId" = ${ws}::uuid AND d.status = 'WON'
          AND d."closedAt" BETWEEN ${tsSql(from)} AND ${tsSql(to)} ${ownDeal}
        GROUP BY 1`),
      this.series(granularity, from, to, Prisma.sql`
        SELECT date_trunc(${granularity}, c."createdAt") AS bucket, COUNT(*)::float8 AS value
        FROM customers c WHERE c."workspaceId" = ${ws}::uuid AND c."createdAt" BETWEEN ${tsSql(from)} AND ${tsSql(to)}
          ${own ? Prisma.sql`AND c."assignedToId" = ${own}::uuid` : Prisma.empty}
        GROUP BY 1`),
      this.series(granularity, from, to, Prisma.sql`
        SELECT date_trunc(${granularity}, a."occurredAt") AS bucket, COUNT(*)::float8 AS value
        FROM activities a WHERE a."workspaceId" = ${ws}::uuid AND a."occurredAt" BETWEEN ${tsSql(from)} AND ${tsSql(to)}
          ${own ? Prisma.sql`AND a."userId" = ${own}::uuid` : Prisma.empty}
        GROUP BY 1`),
      this.conversionSeries(granularity, from, to, ws, own),
    ]);

    const [leadsByStatus, activitiesByType, pipelineByStage] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['status'], where: { workspaceId: ws, archivedAt: null, ...assigned }, _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.activity.groupBy({
        by: ['type'],
        where: { workspaceId: ws, occurredAt: inRange, ...(own ? { userId: own } : {}) },
        _count: { _all: true },
        orderBy: { type: 'asc' },
      }),
      this.pipelineByStage(ws, own),
    ]);

    const teamVisible = hasPermission(ctx.role, 'analytics:team') && ctx.features.includes('team_performance');
    const wonCount = won._count;

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      currency: ctx.currency,
      kpis: {
        totalCustomers,
        newCustomers,
        totalLeads,
        newLeads,
        qualifiedLeads,
        convertedLeads,
        leadConversionRate: pct(convertedOfNew, newLeads),
        activeDeals: openDeals._count,
        pipelineValue: openDeals._sum.value?.toNumber() ?? 0,
        weightedPipelineValue: round2(weighted?.weighted ?? 0),
        closedWonDeals: wonCount,
        closedLostDeals: lost,
        revenue: won._sum.value?.toNumber() ?? 0,
        winRate: pct(wonCount, wonCount + lost),
        completedTasks,
        overdueTasks,
        openTasks,
        activities,
      },
      revenueByPeriod,
      customersByPeriod,
      leadsByStatus: leadsByStatus.map((row) => ({ status: row.status, count: (row._count as { _all: number })._all })),
      leadConversionByPeriod,
      pipelineByStage,
      activitiesByType: activitiesByType.map((row) => ({ type: row.type, count: (row._count as { _all: number })._all })),
      activitiesByPeriod,
      teamPerformance: teamVisible ? await this.teamPerformance(ws, from, to) : null,
    };
  }

  /** Fills every period in the range (zero when no rows) using generate_series. */
  private async series(granularity: Granularity, from: Date, to: Date, inner: Prisma.Sql): Promise<TimeSeriesPoint[]> {
    const step = Prisma.raw(`'1 ${granularity}'`);
    const rows = await this.prisma.$queryRaw<{ period: string; value: number }[]>`
      WITH periods AS (
        SELECT generate_series(date_trunc(${granularity}, ${tsSql(from)}), date_trunc(${granularity}, ${tsSql(to)}), ${step}::interval) AS bucket
      ), data AS (${inner})
      SELECT to_char(p.bucket, 'YYYY-MM-DD') AS period, COALESCE(d.value, 0)::float8 AS value
      FROM periods p LEFT JOIN data d ON d.bucket = p.bucket
      ORDER BY p.bucket`;
    return rows.map((r) => ({ period: r.period, value: round2(Number(r.value)) }));
  }

  private async conversionSeries(granularity: Granularity, from: Date, to: Date, ws: string, own: string | null) {
    const ownLead = own ? Prisma.sql`AND l."assignedToId" = ${own}::uuid` : Prisma.empty;
    const [created, converted] = await Promise.all([
      this.series(granularity, from, to, Prisma.sql`
        SELECT date_trunc(${granularity}, l."createdAt") AS bucket, COUNT(*)::float8 AS value
        FROM leads l WHERE l."workspaceId" = ${ws}::uuid AND l."createdAt" BETWEEN ${tsSql(from)} AND ${tsSql(to)} ${ownLead}
        GROUP BY 1`),
      this.series(granularity, from, to, Prisma.sql`
        SELECT date_trunc(${granularity}, l."convertedAt") AS bucket, COUNT(*)::float8 AS value
        FROM leads l WHERE l."workspaceId" = ${ws}::uuid AND l."convertedAt" BETWEEN ${tsSql(from)} AND ${tsSql(to)} ${ownLead}
        GROUP BY 1`),
    ]);
    return created.map((point, index) => ({ period: point.period, created: point.value, converted: converted[index]?.value ?? 0 }));
  }

  private async pipelineByStage(ws: string, own: string | null) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { workspaceId: ws },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (!pipeline) return [];
    const rows = await this.prisma.$queryRaw<
      { stageId: string; stage: string; type: 'OPEN' | 'WON' | 'LOST'; count: number; value: number; weighted: number }[]
    >`
      SELECT s.id AS "stageId", s.name AS stage, s.type::text AS type,
             COUNT(d.id)::int AS count,
             COALESCE(SUM(d.value), 0)::float8 AS value,
             COALESCE(SUM(d.value * CASE WHEN d.status = 'WON' THEN 100 WHEN d.status = 'LOST' THEN 0
                                         ELSE COALESCE(d.probability, s.probability) END / 100.0), 0)::float8 AS weighted
      FROM stages s
      LEFT JOIN deals d ON d."stageId" = s.id AND d."archivedAt" IS NULL
        ${own ? Prisma.sql`AND d."assignedToId" = ${own}::uuid` : Prisma.empty}
      WHERE s."pipelineId" = ${pipeline.id}::uuid
      GROUP BY s.id, s.name, s.type, s.position
      ORDER BY s.position`;
    return rows.map((r) => ({ stageId: r.stageId, stage: r.stage, type: r.type, count: r.count, value: round2(r.value), weightedValue: round2(r.weighted) }));
  }

  /** Per-member performance using a fixed number of grouped queries (no N+1). */
  private async teamPerformance(ws: string, from: Date, to: Date): Promise<RepPerformance[]> {
    const inRange = { gte: from, lte: to };
    const [members, wonDeals, openDeals, activities, tasks, conversions] = await Promise.all([
      this.prisma.membership.findMany({ where: { workspaceId: ws }, include: { user: { select: { id: true, name: true, email: true } } } }),
      this.prisma.deal.groupBy({ by: ['assignedToId'], where: { workspaceId: ws, status: 'WON', closedAt: inRange }, _count: { _all: true }, _sum: { value: true } }),
      this.prisma.deal.groupBy({ by: ['assignedToId'], where: { workspaceId: ws, status: 'OPEN', archivedAt: null }, _sum: { value: true } }),
      this.prisma.activity.groupBy({ by: ['userId'], where: { workspaceId: ws, occurredAt: inRange }, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['assignedToId'], where: { workspaceId: ws, status: 'COMPLETED', completedAt: inRange }, _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['convertedById'], where: { workspaceId: ws, convertedAt: inRange }, _count: { _all: true } }),
    ]);

    const won = new Map(wonDeals.map((r) => [r.assignedToId, r]));
    const open = new Map(openDeals.map((r) => [r.assignedToId, r]));
    const acts = new Map(activities.map((r) => [r.userId, r._count._all]));
    const done = new Map(tasks.map((r) => [r.assignedToId, r._count._all]));
    const conv = new Map(conversions.map((r) => [r.convertedById, r._count._all]));

    return members
      .map((m) => ({
        user: m.user,
        dealsWon: won.get(m.userId)?._count._all ?? 0,
        revenue: won.get(m.userId)?._sum.value?.toNumber() ?? 0,
        openPipeline: open.get(m.userId)?._sum.value?.toNumber() ?? 0,
        activities: acts.get(m.userId) ?? 0,
        tasksCompleted: done.get(m.userId) ?? 0,
        leadsConverted: conv.get(m.userId) ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.dealsWon - a.dealsWon || a.user.name.localeCompare(b.user.name));
  }
}
