import { Injectable } from '@nestjs/common';
import { PLAN_DEFINITIONS, withinLimit, type Plan, type UsageMetric } from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../../common/errors';

@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  async usage(workspaceId: string): Promise<Record<UsageMetric, number>> {
    const now = new Date();
    const [members, pendingInvites, customers, leads, deals, pipelines] = await this.prisma.$transaction([
      this.prisma.membership.count({ where: { workspaceId } }),
      this.prisma.invitation.count({ where: { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } } }),
      this.prisma.customer.count({ where: { workspaceId, archivedAt: null } }),
      this.prisma.lead.count({ where: { workspaceId, archivedAt: null, status: { not: 'CONVERTED' } } }),
      this.prisma.deal.count({ where: { workspaceId, archivedAt: null } }),
      this.prisma.pipeline.count({ where: { workspaceId } }),
    ]);
    return { members: members + pendingInvites, customers, leads, deals, pipelines };
  }

  /** Throws 402 PLAN_LIMIT_REACHED when adding `increment` items would exceed the plan. */
  async assertWithinLimit(workspaceId: string, plan: Plan, metric: UsageMetric, increment = 1): Promise<void> {
    const limit = PLAN_DEFINITIONS[plan].limits[metric];
    if (limit === null) return;
    const current = (await this.usage(workspaceId))[metric];
    if (!withinLimit(plan, metric, current, increment)) throw AppException.planLimit(metric, limit);
  }
}
