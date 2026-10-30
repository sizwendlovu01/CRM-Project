import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { changePlanSchema, exceededLimits, PLAN_DEFINITIONS, PLANS, type UsageSummary } from '@crm/shared';
import type { z } from 'zod';
import { Public, RequirePermissions, Workspace } from '../../common/decorators';
import type { WorkspaceContext } from '../../common/types';
import { ZBody } from '../../common/zod';
import { AppException } from '../../common/errors';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { PlanLimitsService } from './plan-limits.service';

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

@ApiTags('Subscriptions')
@Controller()
export class SubscriptionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: PlanLimitsService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Get('plans')
  plans() {
    return PLANS.map((plan) => PLAN_DEFINITIONS[plan]);
  }

  @UseGuards(WorkspaceGuard)
  @Get('workspaces/:workspaceId/subscription')
  async summary(@Workspace() ctx: WorkspaceContext): Promise<UsageSummary> {
    return this.buildSummary(ctx.workspaceId);
  }

  /**
   * Simulated plan change. No payment provider is involved and no money is ever charged:
   * the plan is switched immediately and a 30-day simulated billing period is recorded.
   */
  @UseGuards(WorkspaceGuard)
  @RequirePermissions('billing:manage')
  @Post('workspaces/:workspaceId/subscription/change-plan')
  @HttpCode(200)
  async changePlan(@Workspace() ctx: WorkspaceContext, @ZBody(changePlanSchema) body: z.infer<typeof changePlanSchema>) {
    if (body.plan === ctx.plan) {
      throw AppException.badRequest('PLAN_UNCHANGED', `The workspace is already on the ${PLAN_DEFINITIONS[body.plan].name} plan.`);
    }
    const usage = await this.limits.usage(ctx.workspaceId);
    const exceeded = exceededLimits(body.plan, usage);
    if (exceeded.length) {
      throw AppException.conflict(
        'PLAN_DOWNGRADE_BLOCKED',
        `Current usage exceeds the ${PLAN_DEFINITIONS[body.plan].name} plan limits for: ${exceeded.join(', ')}.`,
        exceeded.map((metric) => ({ path: metric, message: `Usage ${usage[metric]} exceeds limit ${PLAN_DEFINITIONS[body.plan].limits[metric]}` })),
      );
    }
    await this.prisma.workspace.update({
      where: { id: ctx.workspaceId },
      data: {
        plan: body.plan,
        subscriptionStatus: 'ACTIVE',
        currentPeriodEnd: body.plan === 'FREE' ? null : new Date(Date.now() + PERIOD_MS),
      },
    });
    await this.audit.log(ctx, {
      action: 'subscription.plan_changed',
      entityType: 'workspace',
      entityId: ctx.workspaceId,
      metadata: { from: ctx.plan, to: body.plan, billingMode: 'simulated' },
    });
    return this.buildSummary(ctx.workspaceId);
  }

  private async buildSummary(workspaceId: string): Promise<UsageSummary> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const usage = await this.limits.usage(workspaceId);
    const definition = PLAN_DEFINITIONS[workspace.plan];
    return {
      plan: workspace.plan,
      subscriptionStatus: workspace.subscriptionStatus,
      currentPeriodEnd: workspace.currentPeriodEnd?.toISOString() ?? null,
      usage: {
        members: { used: usage.members, limit: definition.limits.members },
        customers: { used: usage.customers, limit: definition.limits.customers },
        leads: { used: usage.leads, limit: definition.limits.leads },
        deals: { used: usage.deals, limit: definition.limits.deals },
        pipelines: { used: usage.pipelines, limit: definition.limits.pipelines },
      },
      features: [...definition.features],
      billingMode: 'simulated',
    };
  }
}
