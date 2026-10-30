import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { NOTIFICATION_TYPES, type NotificationDto, type NotificationPreference, type Paginated } from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/mail.templates';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { pageArgs, paginated } from '../../common/pagination';

export interface NotifyInput {
  userId: string;
  workspaceId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  /** Relative application path, e.g. /w/acme/tasks?taskId=... */
  link?: string | null;
  dedupeKey?: string;
  /** The user who caused the event. Users are never notified about their own actions. */
  actorId?: string | null;
}

/** Email is opt-in per type; these defaults apply until the user saves preferences. */
const DEFAULT_EMAIL: Partial<Record<NotificationType, boolean>> = {
  TASK_ASSIGNED: true,
  TASK_OVERDUE: true,
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    if (input.actorId && input.actorId === input.userId) return;
    try {
      const preference = await this.prisma.notificationPreference.findUnique({
        where: { userId_type: { userId: input.userId, type: input.type } },
      });
      const inApp = preference?.inApp ?? true;
      const email = preference?.email ?? DEFAULT_EMAIL[input.type] ?? false;

      if (inApp) {
        // skipDuplicates + unique (userId, dedupeKey): a reminder is only ever created once.
        const created = await this.prisma.notification.createMany({
          data: {
            userId: input.userId,
            workspaceId: input.workspaceId ?? null,
            type: input.type,
            title: input.title,
            body: input.body ?? null,
            link: input.link ?? null,
            dedupeKey: input.dedupeKey ?? null,
          },
          skipDuplicates: true,
        });
        if (created.count === 0) return;
      }

      if (email) {
        const user = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
        if (user) {
          const url = input.link ? `${this.env.APP_URL}${input.link}` : null;
          await this.mail.send({ to: user.email, ...templates.notification(input.title, input.body ?? null, url) });
        }
      }
    } catch (error) {
      // Notifications are side effects; they must never fail the triggering operation.
      this.logger.error(`Failed to send ${input.type} notification: ${(error as Error).message}`);
    }
  }

  /** Workspaces the user currently belongs to (notifications from left workspaces are hidden). */
  private async visibilityFilter(userId: string, workspaceId?: string): Promise<Prisma.NotificationWhereInput> {
    if (workspaceId) return { userId, OR: [{ workspaceId }, { workspaceId: null }] };
    const memberships = await this.prisma.membership.findMany({ where: { userId }, select: { workspaceId: true } });
    return { userId, OR: [{ workspaceId: { in: memberships.map((m) => m.workspaceId) } }, { workspaceId: null }] };
  }

  async list(
    userId: string,
    query: { page: number; pageSize: number; unreadOnly: boolean },
    workspaceId?: string,
  ): Promise<Paginated<NotificationDto> & { unreadCount: number }> {
    const base = await this.visibilityFilter(userId, workspaceId);
    const where: Prisma.NotificationWhereInput = { ...base, ...(query.unreadOnly ? { readAt: null } : {}) };
    const [rows, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(query.page, query.pageSize) }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...base, readAt: null } }),
    ]);
    return {
      ...paginated(rows.map(toDto), total, query.page, query.pageSize),
      unreadCount,
    };
  }

  async unreadCount(userId: string, workspaceId?: string): Promise<number> {
    const base = await this.visibilityFilter(userId, workspaceId);
    return this.prisma.notification.count({ where: { ...base, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  }

  async markUnread(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: null } });
  }

  async markAllRead(userId: string, workspaceId?: string): Promise<number> {
    const base = await this.visibilityFilter(userId, workspaceId);
    const result = await this.prisma.notification.updateMany({ where: { ...base, readAt: null }, data: { readAt: new Date() } });
    return result.count;
  }

  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    const saved = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const byType = new Map(saved.map((p) => [p.type, p]));
    return NOTIFICATION_TYPES.map((type) => {
      const pref = byType.get(type);
      return { type, inApp: pref?.inApp ?? true, email: pref?.email ?? DEFAULT_EMAIL[type] ?? false };
    });
  }

  async updatePreferences(userId: string, preferences: NotificationPreference[]): Promise<NotificationPreference[]> {
    await this.prisma.$transaction(
      preferences.map((pref) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_type: { userId, type: pref.type } },
          create: { userId, type: pref.type, inApp: pref.inApp, email: pref.email },
          update: { inApp: pref.inApp, email: pref.email },
        }),
      ),
    );
    return this.getPreferences(userId);
  }
}

function toDto(row: {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
  workspaceId: string | null;
}): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    workspaceId: row.workspaceId,
  };
}
