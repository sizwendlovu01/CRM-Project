import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { NotificationsService } from './notifications.service';

export const REMINDER_JOB = 'reminders.scan';
const SCAN_INTERVAL_MS = 15 * 60 * 1000;
const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

/**
 * Periodic background job that notifies assignees about tasks that are due soon or overdue.
 * Dedupe keys include the due date, so rescheduling a task produces a fresh reminder.
 */
@Injectable()
export class RemindersService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(REMINDER_JOB, () => this.scan().then(() => undefined));
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.jobs.schedule(REMINDER_JOB, SCAN_INTERVAL_MS);
    } catch (error) {
      this.logger.warn(`Could not schedule reminders: ${(error as Error).message}`);
    }
  }

  async scan(now = new Date()): Promise<{ dueSoon: number; overdue: number }> {
    const tasks = await this.prisma.task.findMany({
      where: {
        status: { in: ['TODO', 'IN_PROGRESS'] },
        assignedToId: { not: null },
        dueAt: { not: null, lte: new Date(now.getTime() + DUE_SOON_WINDOW_MS) },
      },
      include: { workspace: { select: { slug: true } } },
      orderBy: { dueAt: 'asc' },
      take: BATCH_SIZE,
    });

    let dueSoon = 0;
    let overdue = 0;
    for (const task of tasks) {
      if (!task.dueAt || !task.assignedToId) continue;
      const isOverdue = task.dueAt.getTime() < now.getTime();
      if (isOverdue) overdue += 1;
      else dueSoon += 1;
      await this.notifications.notify({
        userId: task.assignedToId,
        workspaceId: task.workspaceId,
        type: isOverdue ? 'TASK_OVERDUE' : 'TASK_DUE_SOON',
        title: isOverdue ? `Task overdue: ${task.title}` : `Task due soon: ${task.title}`,
        body: `Due ${task.dueAt.toUTCString()}`,
        link: `/w/${task.workspace.slug}/tasks?taskId=${task.id}`,
        dedupeKey: `${isOverdue ? 'task-overdue' : 'task-due'}:${task.id}:${task.dueAt.toISOString()}`,
      });
    }
    return { dueSoon, overdue };
  }
}
