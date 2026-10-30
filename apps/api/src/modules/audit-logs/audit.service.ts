import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Paginated, AuditLogEntry } from '@crm/shared';
import { PrismaService } from '../../database/prisma.service';
import type { WorkspaceContext } from '../../common/types';
import { pageArgs, paginated, userSummarySelect } from '../../common/pagination';

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records an audit event. Failures are logged but never break the business operation. */
  async log(ctx: Pick<WorkspaceContext, 'workspaceId' | 'userId' | 'ipAddress'>, event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId ?? null,
          metadata: (event.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: ctx.ipAddress,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for ${event.action}: ${(error as Error).message}`);
    }
  }

  async list(
    workspaceId: string,
    query: { page: number; pageSize: number; entityType?: string },
  ): Promise<Paginated<AuditLogEntry>> {
    const where: Prisma.AuditLogWhereInput = { workspaceId, ...(query.entityType ? { entityType: query.entityType } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: userSummarySelect } },
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(
      rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
        actor: row.actor,
        ipAddress: row.ipAddress,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query.page,
      query.pageSize,
    );
  }
}
