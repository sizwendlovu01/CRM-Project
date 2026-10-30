import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ConvertLeadInput,
  ConvertLeadResult,
  CreateLeadInput,
  Lead,
  LeadListQuery,
  Paginated,
  UpdateLeadInput,
} from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceRefsService } from '../../database/workspace-refs.service';
import { AppException } from '../../common/errors';
import { assigneeFilter, decimalToNumber, pageArgs, paginated, userSummarySelect } from '../../common/pagination';
import { assertAssigneeChange, assertCanModify, resolveAssigneeForCreate } from '../../common/record-access';
import type { WorkspaceContext } from '../../common/types';
import { AuditService } from '../audit-logs/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanLimitsService } from '../subscriptions/plan-limits.service';

const leadInclude = {
  assignedTo: { select: userSummarySelect },
  createdBy: { select: userSummarySelect },
} satisfies Prisma.LeadInclude;

type LeadRow = Prisma.LeadGetPayload<{ include: typeof leadInclude }>;

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    fullName: row.fullName,
    company: row.company,
    email: row.email,
    phone: row.phone,
    jobTitle: row.jobTitle,
    source: row.source,
    status: row.status,
    priority: row.priority,
    estimatedValue: decimalToNumber(row.estimatedValue),
    description: row.description,
    nextFollowUpAt: row.nextFollowUpAt?.toISOString() ?? null,
    assignedTo: row.assignedTo,
    createdBy: row.createdBy,
    convertedAt: row.convertedAt?.toISOString() ?? null,
    convertedCustomerId: row.convertedCustomerId,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: WorkspaceRefsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly limits: PlanLimitsService,
  ) {}

  async list(ctx: WorkspaceContext, query: LeadListQuery): Promise<Paginated<Lead>> {
    const where: Prisma.LeadWhereInput = {
      workspaceId: ctx.workspaceId,
      archivedAt: query.archived ? { not: null } : null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...assigneeFilter(query.assignedToId, ctx.userId),
    };
    if (query.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      where.OR = [{ fullName: contains }, { company: contains }, { email: contains }];
    }
    const orderBy: Prisma.LeadOrderByWithRelationInput[] = [
      query.sortBy === 'nextFollowUpAt' || query.sortBy === 'company'
        ? { [query.sortBy]: { sort: query.sortDir, nulls: 'last' } }
        : { [query.sortBy]: query.sortDir },
      { id: 'asc' },
    ];
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, orderBy, include: leadInclude, ...pageArgs(query.page, query.pageSize) }),
      this.prisma.lead.count({ where }),
    ]);
    // Postgres orders enum values by declaration order, so priority sorts LOW < ... < URGENT.
    return paginated(rows.map(toLead), total, query.page, query.pageSize);
  }

  private async findOrThrow(ctx: WorkspaceContext, id: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: leadInclude });
    if (!lead) throw AppException.notFound('Lead');
    return lead;
  }

  async get(ctx: WorkspaceContext, id: string): Promise<Lead> {
    return toLead(await this.findOrThrow(ctx, id));
  }

  private async notifyAssignee(ctx: WorkspaceContext, lead: LeadRow) {
    if (!lead.assignedToId) return;
    await this.notifications.notify({
      userId: lead.assignedToId,
      workspaceId: ctx.workspaceId,
      type: 'LEAD_ASSIGNED',
      title: `New lead assigned: ${lead.fullName}`,
      body: lead.company ? `Company: ${lead.company}` : null,
      link: `/w/${ctx.workspaceSlug}/leads/${lead.id}`,
      actorId: ctx.userId,
    });
  }

  async create(ctx: WorkspaceContext, input: CreateLeadInput): Promise<Lead> {
    const assignedToId = resolveAssigneeForCreate(ctx, input.assignedToId);
    await this.refs.assertMember(ctx.workspaceId, assignedToId);
    await this.limits.assertWithinLimit(ctx.workspaceId, ctx.plan, 'leads');

    const lead = await this.prisma.lead.create({
      data: {
        workspaceId: ctx.workspaceId,
        fullName: input.fullName,
        company: input.company ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        jobTitle: input.jobTitle ?? null,
        source: input.source,
        status: input.status,
        priority: input.priority,
        estimatedValue: input.estimatedValue ?? null,
        description: input.description ?? null,
        nextFollowUpAt: input.nextFollowUpAt ?? null,
        assignedToId,
        createdById: ctx.userId,
      },
      include: leadInclude,
    });
    await this.notifyAssignee(ctx, lead);
    await this.audit.log(ctx, { action: 'lead.created', entityType: 'lead', entityId: lead.id, metadata: { fullName: lead.fullName } });
    return toLead(lead);
  }

  async update(ctx: WorkspaceContext, id: string, input: UpdateLeadInput): Promise<Lead> {
    const existing = await this.findOrThrow(ctx, id);
    assertCanModify(ctx, existing);
    if (existing.status === 'CONVERTED') {
      throw AppException.conflict('LEAD_CONVERTED', 'Converted leads are read-only. Edit the customer record instead.');
    }
    const reassigned = assertAssigneeChange(ctx, existing.assignedToId, input.assignedToId);
    if (reassigned) await this.refs.assertMember(ctx.workspaceId, input.assignedToId);

    const updated = await this.prisma.lead.update({ where: { id: existing.id }, data: input, include: leadInclude });
    if (reassigned) await this.notifyAssignee(ctx, updated);
    await this.audit.log(ctx, { action: 'lead.updated', entityType: 'lead', entityId: id, metadata: { fields: Object.keys(input) } });
    return toLead(updated);
  }

  async setArchived(ctx: WorkspaceContext, id: string, archived: boolean): Promise<Lead> {
    const existing = await this.findOrThrow(ctx, id);
    assertCanModify(ctx, existing);
    const updated = await this.prisma.lead.update({
      where: { id: existing.id },
      data: { archivedAt: archived ? new Date() : null },
      include: leadInclude,
    });
    await this.audit.log(ctx, { action: archived ? 'lead.archived' : 'lead.restored', entityType: 'lead', entityId: id });
    return toLead(updated);
  }

  async remove(ctx: WorkspaceContext, id: string): Promise<void> {
    const existing = await this.findOrThrow(ctx, id);
    await this.prisma.lead.delete({ where: { id: existing.id } });
    await this.audit.log(ctx, { action: 'lead.deleted', entityType: 'lead', entityId: id, metadata: { fullName: existing.fullName } });
  }

  /**
   * Converts a lead into a customer (and optionally a deal) in a single transaction.
   * The lead row is locked with SELECT ... FOR UPDATE and the status is re-checked inside the
   * transaction, so concurrent or repeated requests can never convert the same lead twice.
   * An existing customer with the same email is reused instead of creating a duplicate.
   */
  async convert(ctx: WorkspaceContext, id: string, input: ConvertLeadInput): Promise<ConvertLeadResult> {
    const lead = await this.findOrThrow(ctx, id);
    assertCanModify(ctx, lead);
    if (lead.status === 'CONVERTED') throw this.alreadyConverted();
    if (lead.archivedAt) throw AppException.badRequest('LEAD_ARCHIVED', 'Restore the lead before converting it.');

    const pipeline = input.createDeal
      ? await this.prisma.pipeline.findFirst({
          where: { workspaceId: ctx.workspaceId, ...(input.pipelineId ? { id: input.pipelineId } : { isDefault: true }) },
          include: { stages: { where: { type: 'OPEN' }, orderBy: { position: 'asc' }, take: 1 } },
        })
      : null;
    if (input.createDeal && (!pipeline || !pipeline.stages[0])) {
      throw AppException.invalidReference('pipelineId', 'Pipeline not found or it has no open stages');
    }
    const existingCustomer = lead.email
      ? await this.prisma.customer.findFirst({
          where: { workspaceId: ctx.workspaceId, email: { equals: lead.email, mode: 'insensitive' } },
          select: { id: true },
        })
      : null;
    if (!existingCustomer) await this.limits.assertWithinLimit(ctx.workspaceId, ctx.plan, 'customers');
    if (input.createDeal) await this.limits.assertWithinLimit(ctx.workspaceId, ctx.plan, 'deals');

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM leads WHERE id = ${id}::uuid AND "workspaceId" = ${ctx.workspaceId}::uuid FOR UPDATE`;
      if (!locked[0]) throw AppException.notFound('Lead');
      if (locked[0].status === 'CONVERTED') throw this.alreadyConverted();

      const assignedToId = lead.assignedToId ?? ctx.userId;
      const customerId =
        existingCustomer?.id ??
        (
          await tx.customer.create({
            data: {
              workspaceId: ctx.workspaceId,
              fullName: lead.fullName,
              company: lead.company,
              email: lead.email,
              phone: lead.phone,
              type: lead.company ? 'BUSINESS' : 'INDIVIDUAL',
              status: input.customerStatus,
              source: 'LEAD_CONVERSION',
              assignedToId,
              createdById: ctx.userId,
              lastInteractionAt: new Date(),
            },
          })
        ).id;

      let dealId: string | null = null;
      if (pipeline && pipeline.stages[0]) {
        const stage = pipeline.stages[0];
        const position = await tx.deal.count({ where: { stageId: stage.id } });
        const deal = await tx.deal.create({
          data: {
            workspaceId: ctx.workspaceId,
            pipelineId: pipeline.id,
            stageId: stage.id,
            title: input.dealTitle ?? `${lead.company ?? lead.fullName} opportunity`,
            value: input.dealValue ?? lead.estimatedValue ?? 0,
            customerId,
            assignedToId,
            createdById: ctx.userId,
            position,
          },
        });
        dealId = deal.id;
      }

      await tx.lead.update({
        where: { id },
        data: { status: 'CONVERTED', convertedAt: new Date(), convertedById: ctx.userId, convertedCustomerId: customerId },
      });

      await tx.activity.create({
        data: {
          workspaceId: ctx.workspaceId,
          type: 'NOTE',
          subject: 'Converted from lead',
          description: `Lead "${lead.fullName}" was converted${dealId ? ' and a deal was created' : ''}.`,
          userId: ctx.userId,
          customerId,
          leadId: id,
          dealId,
        },
      });

      return { customerId, dealId };
    });

    await this.audit.log(ctx, { action: 'lead.converted', entityType: 'lead', entityId: id, metadata: { ...result } });
    return { lead: toLead(await this.findOrThrow(ctx, id)), ...result };
  }

  private alreadyConverted(): AppException {
    return AppException.conflict('LEAD_ALREADY_CONVERTED', 'This lead has already been converted.');
  }
}
