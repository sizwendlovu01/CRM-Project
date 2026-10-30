import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { analyticsQuerySchema, searchQuerySchema, type AnalyticsQuery, type SearchResults } from '@crm/shared';
import type { z } from 'zod';
import { RequirePermissions, Workspace } from '../../common/decorators';
import type { WorkspaceContext } from '../../common/types';
import { ZQuery } from '../../common/zod';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics & search')
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:workspaceId')
class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('analytics/overview')
  @RequirePermissions('analytics:view')
  overview(@Workspace() ctx: WorkspaceContext, @ZQuery(analyticsQuerySchema) query: AnalyticsQuery) {
    return this.analytics.overview(ctx, query);
  }

  /** Global search across customers, leads and deals (top 5 of each). */
  @Get('search')
  @RequirePermissions('records:read')
  async search(@Workspace() ctx: WorkspaceContext, @ZQuery(searchQuerySchema) query: z.infer<typeof searchQuerySchema>): Promise<SearchResults> {
    const contains = { contains: query.q, mode: 'insensitive' as const };
    const workspaceId = ctx.workspaceId;
    const [customers, leads, deals] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where: { workspaceId, archivedAt: null, OR: [{ fullName: contains }, { company: contains }, { email: contains }] },
        select: { id: true, fullName: true, company: true, email: true },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.lead.findMany({
        where: { workspaceId, archivedAt: null, OR: [{ fullName: contains }, { company: contains }, { email: contains }] },
        select: { id: true, fullName: true, company: true, status: true },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.deal.findMany({
        where: { workspaceId, archivedAt: null, title: contains },
        select: { id: true, title: true, value: true, status: true },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return { customers, leads, deals: deals.map((d) => ({ ...d, value: d.value.toNumber() })) };
  }
}

@Module({ controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
