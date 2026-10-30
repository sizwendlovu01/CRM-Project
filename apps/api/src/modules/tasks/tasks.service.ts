import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateTaskInput, Paginated, Task, TaskComment, TaskListQuery, UpdateTaskInput } from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceRefsService } from '../../database/workspace-refs.service';
import { AppException } from '../../common/errors';
import { assigneeFilter, pageArgs, paginated, userSummarySelect } from '../../common/pagination';
import { assertAssigneeChange, assertCanModify, resolveAssigneeForCreate } from '../../common/record-access';
import type { WorkspaceContext } from '../../common/types';
import { AuditService } from '../audit-logs/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

const taskInclude = {
  assignedTo: { select: userSummarySelect },
  createdBy: { select: userSummarySelect },
  customer: { select: { id: true, fullName: true } },
  deal: { select: { id: true, title: true } },
  lead: { select: { id: true, fullName: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

const OPEN_STATUSES = ['TODO', 'IN_PROGRESS'] as const;

export function isTaskOverdue(task: { status: string; dueAt: Date | null }, now = new Date()): boolean {
  return Boolean(task.dueAt && task.dueAt.getTime() < now.getTime() && (OPEN_STATUSES as readonly string[]).includes(task.status));
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueAt: row.dueAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    isOverdue: isTaskOverdue(row),
    assignedTo: row.assignedTo,
    createdBy: row.createdBy,
    customer: row.customer,
    deal: row.deal,
    lead: row.lead,
    commentCount: row._count.comments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: WorkspaceRefsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private dueFilter(due: TaskListQuery['due']): Prisma.TaskWhereInput {
    const now = new Date();
    switch (due) {
      case 'overdue':
        return { dueAt: { lt: now }, status: { in: [...OPEN_STATUSES] } };
      case 'today': {
        const start = startOfUtcDay(now);
        return { dueAt: { gte: start, lt: new Date(start.getTime() + 86_400_000) } };
      }
      case 'week':
        return { dueAt: { gte: now, lt: new Date(now.getTime() + 7 * 86_400_000) } };
      case 'none':
        return { dueAt: null };
      default:
        return {};
    }
  }

  async list(ctx: WorkspaceContext, query: TaskListQuery): Promise<Paginated<Task>> {
    const where: Prisma.TaskWhereInput = {
      workspaceId: ctx.workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.dealId ? { dealId: query.dealId } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...assigneeFilter(query.assignedToId, ctx.userId),
      ...this.dueFilter(query.due),
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    // A due-filter status constraint must not be overridden by an explicit status filter.
    if (query.due === 'overdue' && query.status) where.status = OPEN_STATUSES.includes(query.status as never) ? query.status : { in: [] };

    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [
      query.sortBy === 'dueAt' ? { dueAt: { sort: query.sortDir, nulls: 'last' } } : { [query.sortBy]: query.sortDir },
      { createdAt: 'desc' },
    ];
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({ where, orderBy, include: taskInclude, ...pageArgs(query.page, query.pageSize) }),
      this.prisma.task.count({ where }),
    ]);
    return paginated(rows.map(toTask), total, query.page, query.pageSize);
  }

  private async findOrThrow(ctx: WorkspaceContext, id: string): Promise<TaskRow> {
    const task = await this.prisma.task.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: taskInclude });
    if (!task) throw AppException.notFound('Task');
    return task;
  }

  async get(ctx: WorkspaceContext, id: string): Promise<Task> {
    return toTask(await this.findOrThrow(ctx, id));
  }

  private async assertLinks(ctx: WorkspaceContext, input: Pick<UpdateTaskInput, 'customerId' | 'dealId' | 'leadId'>) {
    await this.refs.assertCustomer(ctx.workspaceId, input.customerId);
    await this.refs.assertDeal(ctx.workspaceId, input.dealId);
    await this.refs.assertLead(ctx.workspaceId, input.leadId);
  }

  private async notifyAssigned(ctx: WorkspaceContext, task: TaskRow) {
    if (!task.assignedToId) return;
    await this.notifications.notify({
      userId: task.assignedToId,
      workspaceId: ctx.workspaceId,
      type: 'TASK_ASSIGNED',
      title: `New task: ${task.title}`,
      body: task.dueAt ? `Due ${task.dueAt.toUTCString()}` : null,
      link: `/w/${ctx.workspaceSlug}/tasks?taskId=${task.id}`,
      actorId: ctx.userId,
    });
  }

  async create(ctx: WorkspaceContext, input: CreateTaskInput): Promise<Task> {
    const assignedToId = resolveAssigneeForCreate(ctx, input.assignedToId);
    await this.refs.assertMember(ctx.workspaceId, assignedToId);
    await this.assertLinks(ctx, input);

    const task = await this.prisma.task.create({
      data: {
        workspaceId: ctx.workspaceId,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        dueAt: input.dueAt ?? null,
        completedAt: input.status === 'COMPLETED' ? new Date() : null,
        assignedToId,
        createdById: ctx.userId,
        customerId: input.customerId ?? null,
        dealId: input.dealId ?? null,
        leadId: input.leadId ?? null,
      },
      include: taskInclude,
    });
    await this.notifyAssigned(ctx, task);
    await this.audit.log(ctx, { action: 'task.created', entityType: 'task', entityId: task.id, metadata: { title: task.title } });
    return toTask(task);
  }

  async update(ctx: WorkspaceContext, id: string, input: UpdateTaskInput): Promise<Task> {
    const existing = await this.findOrThrow(ctx, id);
    assertCanModify(ctx, existing);
    const reassigned = assertAssigneeChange(ctx, existing.assignedToId, input.assignedToId);
    if (reassigned) await this.refs.assertMember(ctx.workspaceId, input.assignedToId);
    await this.assertLinks(ctx, input);

    const data: Prisma.TaskUncheckedUpdateInput = { ...input };
    if (input.status && input.status !== existing.status) {
      data.completedAt = input.status === 'COMPLETED' ? new Date() : null;
    }
    const updated = await this.prisma.task.update({ where: { id }, data, include: taskInclude });
    if (reassigned) await this.notifyAssigned(ctx, updated);
    await this.audit.log(ctx, { action: 'task.updated', entityType: 'task', entityId: id, metadata: { fields: Object.keys(input) } });
    return toTask(updated);
  }

  async remove(ctx: WorkspaceContext, id: string): Promise<void> {
    const existing = await this.findOrThrow(ctx, id);
    assertCanModify(ctx, existing);
    await this.prisma.task.delete({ where: { id } });
    await this.audit.log(ctx, { action: 'task.deleted', entityType: 'task', entityId: id, metadata: { title: existing.title } });
  }

  async comments(ctx: WorkspaceContext, taskId: string): Promise<TaskComment[]> {
    await this.findOrThrow(ctx, taskId);
    const rows = await this.prisma.taskComment.findMany({
      where: { taskId, workspaceId: ctx.workspaceId },
      include: { author: { select: userSummarySelect } },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return rows.map((c) => ({ id: c.id, body: c.body, author: c.author, createdAt: c.createdAt.toISOString() }));
  }

  async addComment(ctx: WorkspaceContext, taskId: string, body: string): Promise<TaskComment> {
    const task = await this.findOrThrow(ctx, taskId);
    const comment = await this.prisma.taskComment.create({
      data: { taskId, workspaceId: ctx.workspaceId, authorId: ctx.userId, body },
      include: { author: { select: userSummarySelect } },
    });
    if (task.assignedToId) {
      await this.notifications.notify({
        userId: task.assignedToId,
        workspaceId: ctx.workspaceId,
        type: 'TASK_ASSIGNED',
        title: `New comment on "${task.title}"`,
        body: body.slice(0, 140),
        link: `/w/${ctx.workspaceSlug}/tasks?taskId=${task.id}`,
        actorId: ctx.userId,
      });
    }
    return { id: comment.id, body: comment.body, author: comment.author, createdAt: comment.createdAt.toISOString() };
  }

  async removeComment(ctx: WorkspaceContext, taskId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.taskComment.findFirst({ where: { id: commentId, taskId, workspaceId: ctx.workspaceId } });
    if (!comment) throw AppException.notFound('Comment');
    assertCanModify(ctx, { createdById: comment.authorId });
    await this.prisma.taskComment.delete({ where: { id: commentId } });
  }
}
