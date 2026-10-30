import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateCustomerInput,
  Customer,
  CustomerDetail,
  CustomerListQuery,
  DuplicateGroup,
  ImportResult,
  Paginated,
  UpdateCustomerInput,
} from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceRefsService } from '../../database/workspace-refs.service';
import { AppException } from '../../common/errors';
import { assigneeFilter, pageArgs, paginated } from '../../common/pagination';
import { assertAssigneeChange, assertCanModify, resolveAssigneeForCreate } from '../../common/record-access';
import type { WorkspaceContext } from '../../common/types';
import { AuditService } from '../audit-logs/audit.service';
import { PlanLimitsService } from '../subscriptions/plan-limits.service';
import { customerInclude, toCustomer } from './customers.mapper';
import { CUSTOMER_EXPORT_HEADERS, customerToCsvRow, parseCustomerCsv } from './customer-csv';

const EXPORT_LIMIT = 10_000;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: WorkspaceRefsService,
    private readonly audit: AuditService,
    private readonly limits: PlanLimitsService,
  ) {}

  private buildWhere(ctx: WorkspaceContext, query: Omit<CustomerListQuery, 'page' | 'pageSize' | 'sortBy' | 'sortDir'>) {
    const where: Prisma.CustomerWhereInput = {
      workspaceId: ctx.workspaceId,
      archivedAt: query.archived ? { not: null } : null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...assigneeFilter(query.assignedToId, ctx.userId),
    };
    if (query.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      where.OR = [{ fullName: contains }, { company: contains }, { email: contains }, { phone: { contains: query.q } }];
    }
    return where;
  }

  async list(ctx: WorkspaceContext, query: CustomerListQuery): Promise<Paginated<Customer>> {
    const where = this.buildWhere(ctx, query);
    const orderBy: Prisma.CustomerOrderByWithRelationInput[] = [
      query.sortBy === 'lastInteractionAt' || query.sortBy === 'company'
        ? { [query.sortBy]: { sort: query.sortDir, nulls: 'last' } }
        : { [query.sortBy]: query.sortDir },
      { id: 'asc' },
    ];
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, orderBy, include: customerInclude, ...pageArgs(query.page, query.pageSize) }),
      this.prisma.customer.count({ where }),
    ]);
    return paginated(rows.map(toCustomer), total, query.page, query.pageSize);
  }

  private async findOrThrow(ctx: WorkspaceContext, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: customerInclude });
    if (!customer) throw AppException.notFound('Customer');
    return customer;
  }

  async get(ctx: WorkspaceContext, id: string): Promise<CustomerDetail> {
    const customer = await this.findOrThrow(ctx, id);
    const [openDeals, wonDeals, openTasks] = await this.prisma.$transaction([
      this.prisma.deal.aggregate({
        where: { workspaceId: ctx.workspaceId, customerId: id, status: 'OPEN', archivedAt: null },
        _count: true,
        _sum: { value: true },
      }),
      this.prisma.deal.aggregate({ where: { workspaceId: ctx.workspaceId, customerId: id, status: 'WON' }, _sum: { value: true } }),
      this.prisma.task.count({ where: { workspaceId: ctx.workspaceId, customerId: id, status: { in: ['TODO', 'IN_PROGRESS'] } } }),
    ]);
    return {
      ...toCustomer(customer),
      stats: {
        openDeals: openDeals._count,
        openDealValue: openDeals._sum.value?.toNumber() ?? 0,
        wonDealValue: wonDeals._sum.value?.toNumber() ?? 0,
        openTasks,
      },
    };
  }

  private async assertUniqueEmail(ctx: WorkspaceContext, email: string | null | undefined, exceptId?: string) {
    if (!email) return;
    const existing = await this.prisma.customer.findFirst({
      where: { workspaceId: ctx.workspaceId, email: { equals: email, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true, fullName: true },
    });
    if (existing) {
      throw AppException.conflict('DUPLICATE_CUSTOMER', `A customer with this email already exists (${existing.fullName}).`, [
        { path: 'email', message: `Duplicate of customer ${existing.id}` },
      ]);
    }
  }

  async create(ctx: WorkspaceContext, input: CreateCustomerInput): Promise<Customer> {
    const assignedToId = resolveAssigneeForCreate(ctx, input.assignedToId);
    await this.refs.assertMember(ctx.workspaceId, assignedToId);
    await this.assertUniqueEmail(ctx, input.email);
    await this.limits.assertWithinLimit(ctx.workspaceId, ctx.plan, 'customers');

    const customer = await this.prisma.customer.create({
      data: {
        workspaceId: ctx.workspaceId,
        fullName: input.fullName,
        company: input.company ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        industry: input.industry ?? null,
        type: input.type,
        status: input.status,
        source: input.source,
        assignedToId,
        createdById: ctx.userId,
      },
      include: customerInclude,
    });
    await this.audit.log(ctx, { action: 'customer.created', entityType: 'customer', entityId: customer.id, metadata: { fullName: customer.fullName } });
    return toCustomer(customer);
  }

  async update(ctx: WorkspaceContext, id: string, input: UpdateCustomerInput): Promise<Customer> {
    const existing = await this.findOrThrow(ctx, id);
    assertCanModify(ctx, existing);
    if (assertAssigneeChange(ctx, existing.assignedToId, input.assignedToId)) {
      await this.refs.assertMember(ctx.workspaceId, input.assignedToId);
    }
    if (input.email !== undefined && input.email !== existing.email) await this.assertUniqueEmail(ctx, input.email, id);

    const updated = await this.prisma.customer.update({ where: { id: existing.id }, data: input, include: customerInclude });
    await this.audit.log(ctx, { action: 'customer.updated', entityType: 'customer', entityId: id, metadata: { fields: Object.keys(input) } });
    return toCustomer(updated);
  }

  async setArchived(ctx: WorkspaceContext, id: string, archived: boolean): Promise<Customer> {
    const existing = await this.findOrThrow(ctx, id);
    assertCanModify(ctx, existing);
    if (!archived) await this.limits.assertWithinLimit(ctx.workspaceId, ctx.plan, 'customers');
    const updated = await this.prisma.customer.update({
      where: { id: existing.id },
      data: { archivedAt: archived ? new Date() : null },
      include: customerInclude,
    });
    await this.audit.log(ctx, { action: archived ? 'customer.archived' : 'customer.restored', entityType: 'customer', entityId: id });
    return toCustomer(updated);
  }

  async remove(ctx: WorkspaceContext, id: string): Promise<void> {
    const existing = await this.findOrThrow(ctx, id);
    await this.prisma.customer.delete({ where: { id: existing.id } });
    await this.audit.log(ctx, { action: 'customer.deleted', entityType: 'customer', entityId: id, metadata: { fullName: existing.fullName } });
  }

  async exportCsv(ctx: WorkspaceContext, query: CustomerListQuery): Promise<string> {
    const rows = await this.prisma.customer.findMany({
      where: this.buildWhere(ctx, query),
      orderBy: [{ [query.sortBy]: query.sortDir }, { id: 'asc' }],
      include: customerInclude,
      take: EXPORT_LIMIT,
    });
    await this.audit.log(ctx, { action: 'customer.exported', entityType: 'customer', metadata: { rows: rows.length } });
    return [CUSTOMER_EXPORT_HEADERS.join(','), ...rows.map((row) => customerToCsvRow(toCustomer(row)))].join('\r\n') + '\r\n';
  }

  async importCsv(ctx: WorkspaceContext, content: string): Promise<ImportResult> {
    const { rows, fatal } = parseCustomerCsv(content);
    if (fatal) throw AppException.badRequest('INVALID_CSV', fatal);
    if (rows.length === 0) throw AppException.badRequest('INVALID_CSV', 'The CSV file does not contain any rows.');

    const errors = rows.filter((r) => r.error).map((r) => ({ row: r.row, message: r.error as string }));
    const valid = rows.filter((r) => r.data);

    const emails = valid.map((r) => r.data?.email).filter((e): e is string => Boolean(e));
    const existing = emails.length
      ? await this.prisma.customer.findMany({
          where: { workspaceId: ctx.workspaceId, email: { in: emails, mode: 'insensitive' } },
          select: { email: true },
        })
      : [];
    const seen = new Set(existing.map((c) => c.email?.toLowerCase()));

    let skippedDuplicates = 0;
    const toCreate: Prisma.CustomerCreateManyInput[] = [];
    for (const row of valid) {
      const data = row.data!;
      const email = data.email?.toLowerCase();
      if (email && seen.has(email)) {
        skippedDuplicates += 1;
        continue;
      }
      if (email) seen.add(email);
      toCreate.push({
        workspaceId: ctx.workspaceId,
        fullName: data.fullName,
        company: data.company ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        industry: data.industry ?? null,
        type: data.type,
        status: data.status,
        source: data.source,
        assignedToId: ctx.userId,
        createdById: ctx.userId,
      });
    }

    if (toCreate.length) {
      await this.limits.assertWithinLimit(ctx.workspaceId, ctx.plan, 'customers', toCreate.length);
      await this.prisma.$transaction(async (tx) => {
        for (let i = 0; i < toCreate.length; i += 500) {
          await tx.customer.createMany({ data: toCreate.slice(i, i + 500) });
        }
      });
    }

    const result: ImportResult = { totalRows: rows.length, created: toCreate.length, skippedDuplicates, errors: errors.slice(0, 100) };
    await this.audit.log(ctx, { action: 'customer.imported', entityType: 'customer', metadata: { ...result, errors: errors.length } });
    return result;
  }

  /** Finds potential duplicates by normalised phone number and by name + company. */
  async duplicates(ctx: WorkspaceContext): Promise<DuplicateGroup[]> {
    const phoneGroups = await this.prisma.$queryRaw<{ value: string; ids: string[] }[]>`
      SELECT regexp_replace(phone, '[^0-9]', '', 'g') AS value, array_agg(id::text ORDER BY "createdAt") AS ids
      FROM customers
      WHERE "workspaceId" = ${ctx.workspaceId}::uuid AND "archivedAt" IS NULL AND phone IS NOT NULL
        AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 6
      GROUP BY 1 HAVING count(*) > 1 LIMIT 25`;
    const nameGroups = await this.prisma.$queryRaw<{ value: string; ids: string[] }[]>`
      SELECT lower("fullName") || ' / ' || lower(coalesce(company, '')) AS value, array_agg(id::text ORDER BY "createdAt") AS ids
      FROM customers
      WHERE "workspaceId" = ${ctx.workspaceId}::uuid AND "archivedAt" IS NULL
      GROUP BY lower("fullName"), lower(coalesce(company, '')) HAVING count(*) > 1 LIMIT 25`;

    const ids = [...new Set([...phoneGroups, ...nameGroups].flatMap((g) => g.ids))];
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: ids }, workspaceId: ctx.workspaceId },
      select: { id: true, fullName: true, company: true, email: true, phone: true, createdAt: true },
    });
    const byId = new Map(customers.map((c) => [c.id, { ...c, createdAt: c.createdAt.toISOString() }]));
    const toGroup = (reason: DuplicateGroup['reason']) => (g: { value: string; ids: string[] }): DuplicateGroup => ({
      reason,
      value: g.value,
      customers: g.ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c)),
    });
    return [...phoneGroups.map(toGroup('phone')), ...nameGroups.map(toGroup('name_company'))];
  }
}
