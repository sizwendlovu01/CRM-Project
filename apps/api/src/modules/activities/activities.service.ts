import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Activity, ActivityListQuery, CreateActivityInput, CreateNoteInput, Note, Paginated, TimelineItem } from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceRefsService } from '../../database/workspace-refs.service';
import { AppException } from '../../common/errors';
import { pageArgs, paginated, userSummarySelect } from '../../common/pagination';
import { assertCanModify } from '../../common/record-access';
import type { WorkspaceContext } from '../../common/types';
import { NotificationsService } from '../notifications/notifications.service';

const activityInclude = {
  user: { select: userSummarySelect },
  customer: { select: { id: true, fullName: true } },
  lead: { select: { id: true, fullName: true } },
  deal: { select: { id: true, title: true } },
} satisfies Prisma.ActivityInclude;

type ActivityRow = Prisma.ActivityGetPayload<{ include: typeof activityInclude }>;

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    type: row.type,
    subject: row.subject,
    description: row.description,
    occurredAt: row.occurredAt.toISOString(),
    durationMinutes: row.durationMinutes,
    outcome: row.outcome,
    user: row.user,
    customer: row.customer,
    lead: row.lead,
    deal: row.deal,
    createdAt: row.createdAt.toISOString(),
  };
}

type NoteRow = Prisma.NoteGetPayload<{ include: { author: { select: typeof userSummarySelect } } }>;

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    body: row.body,
    author: row.author,
    customerId: row.customerId,
    leadId: row.leadId,
    dealId: row.dealId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Interaction types that should alert the customer's owner when logged by someone else. */
const NOTIFY_TYPES = new Set(['CALL', 'MEETING', 'EMAIL']);
const TIMELINE_LIMIT = 100;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: WorkspaceRefsService,
    private readonly notifications: NotificationsService,
  ) {}

  private async assertLinks(ctx: WorkspaceContext, input: { customerId?: string | null; leadId?: string | null; dealId?: string | null }) {
    await this.refs.assertCustomer(ctx.workspaceId, input.customerId);
    await this.refs.assertLead(ctx.workspaceId, input.leadId);
    await this.refs.assertDeal(ctx.workspaceId, input.dealId);
  }

  async list(ctx: WorkspaceContext, query: ActivityListQuery): Promise<Paginated<Activity>> {
    const where: Prisma.ActivityWhereInput = {
      workspaceId: ctx.workspaceId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.dealId ? { dealId: query.dealId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.q ? { OR: [{ subject: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        where,
        include: activityInclude,
        orderBy: [{ occurredAt: query.sortDir }, { id: 'asc' }],
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.activity.count({ where }),
    ]);
    return paginated(rows.map(toActivity), total, query.page, query.pageSize);
  }

  async create(ctx: WorkspaceContext, input: CreateActivityInput): Promise<Activity> {
    await this.assertLinks(ctx, input);
    const occurredAt = input.occurredAt ?? new Date();

    const activity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.activity.create({
        data: {
          workspaceId: ctx.workspaceId,
          type: input.type,
          subject: input.subject,
          description: input.description ?? null,
          occurredAt,
          durationMinutes: input.durationMinutes ?? null,
          outcome: input.outcome ?? null,
          userId: ctx.userId,
          customerId: input.customerId ?? null,
          leadId: input.leadId ?? null,
          dealId: input.dealId ?? null,
        },
        include: activityInclude,
      });
      if (input.customerId) {
        // Only move lastInteractionAt forward (back-dated activities must not regress it).
        await tx.customer.updateMany({
          where: { id: input.customerId, OR: [{ lastInteractionAt: null }, { lastInteractionAt: { lt: occurredAt } }] },
          data: { lastInteractionAt: occurredAt },
        });
      }
      return created;
    });

    if (input.customerId && NOTIFY_TYPES.has(input.type)) {
      const customer = await this.prisma.customer.findUnique({ where: { id: input.customerId }, select: { assignedToId: true, fullName: true } });
      if (customer?.assignedToId) {
        await this.notifications.notify({
          userId: customer.assignedToId,
          workspaceId: ctx.workspaceId,
          type: 'CUSTOMER_ACTIVITY',
          title: `${activity.user?.name ?? 'A teammate'} logged a ${input.type.toLowerCase()} with ${customer.fullName}`,
          body: input.subject,
          link: `/w/${ctx.workspaceSlug}/customers/${input.customerId}`,
          actorId: ctx.userId,
        });
      }
    }
    return toActivity(activity);
  }

  async remove(ctx: WorkspaceContext, id: string): Promise<void> {
    const activity = await this.prisma.activity.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (!activity) throw AppException.notFound('Activity');
    assertCanModify(ctx, { createdById: activity.userId });
    await this.prisma.activity.delete({ where: { id } });
  }

  /* -------------------------------- Notes -------------------------------- */

  async notes(ctx: WorkspaceContext, filter: { customerId?: string; leadId?: string; dealId?: string }): Promise<Note[]> {
    if (!filter.customerId && !filter.leadId && !filter.dealId) {
      throw AppException.badRequest('FILTER_REQUIRED', 'Provide customerId, leadId or dealId.');
    }
    const rows = await this.prisma.note.findMany({
      where: { workspaceId: ctx.workspaceId, ...filter },
      include: { author: { select: userSummarySelect } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toNote);
  }

  async createNote(ctx: WorkspaceContext, input: CreateNoteInput): Promise<Note> {
    await this.assertLinks(ctx, input);
    const note = await this.prisma.note.create({
      data: {
        workspaceId: ctx.workspaceId,
        authorId: ctx.userId,
        body: input.body,
        customerId: input.customerId ?? null,
        leadId: input.leadId ?? null,
        dealId: input.dealId ?? null,
      },
      include: { author: { select: userSummarySelect } },
    });
    return toNote(note);
  }

  async removeNote(ctx: WorkspaceContext, id: string): Promise<void> {
    const note = await this.prisma.note.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (!note) throw AppException.notFound('Note');
    assertCanModify(ctx, { createdById: note.authorId });
    await this.prisma.note.delete({ where: { id } });
  }

  /* ------------------------------- Timeline ------------------------------ */

  /** Chronological feed (newest first) of everything that happened with a customer. */
  async customerTimeline(ctx: WorkspaceContext, customerId: string): Promise<TimelineItem[]> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!customer) throw AppException.notFound('Customer');
    const where = { workspaceId: ctx.workspaceId, customerId };
    const [activities, notes, tasks, deals] = await this.prisma.$transaction([
      this.prisma.activity.findMany({ where, include: activityInclude, orderBy: { occurredAt: 'desc' }, take: TIMELINE_LIMIT }),
      this.prisma.note.findMany({ where, include: { author: { select: userSummarySelect } }, orderBy: { createdAt: 'desc' }, take: TIMELINE_LIMIT }),
      this.prisma.task.findMany({ where, orderBy: { createdAt: 'desc' }, take: TIMELINE_LIMIT }),
      this.prisma.deal.findMany({ where, orderBy: { createdAt: 'desc' }, take: TIMELINE_LIMIT }),
    ]);

    const items: TimelineItem[] = [
      ...activities.map((a): TimelineItem => ({ kind: 'activity', at: a.occurredAt.toISOString(), activity: toActivity(a) })),
      ...notes.map((n): TimelineItem => ({ kind: 'note', at: n.createdAt.toISOString(), note: toNote(n) })),
      ...tasks.map((t): TimelineItem => ({
        kind: 'task',
        at: (t.completedAt ?? t.createdAt).toISOString(),
        task: { id: t.id, title: t.title, status: t.status, dueAt: t.dueAt?.toISOString() ?? null, completedAt: t.completedAt?.toISOString() ?? null },
      })),
      ...deals.map((d): TimelineItem => ({
        kind: 'deal',
        at: (d.closedAt ?? d.createdAt).toISOString(),
        deal: { id: d.id, title: d.title, value: d.value.toNumber(), status: d.status },
      })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, TIMELINE_LIMIT);
  }
}
