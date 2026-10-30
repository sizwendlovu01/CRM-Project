import { Controller, Get, Global, Module, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { auditLogQuerySchema } from '@crm/shared';
import type { z } from 'zod';
import { RequireFeature, RequirePermissions, Workspace } from '../../common/decorators';
import type { WorkspaceContext } from '../../common/types';
import { ZQuery } from '../../common/zod';
import { WorkspaceGuard } from '../workspaces/workspace.guard';
import { AuditService } from './audit.service';

@ApiTags('Audit logs')
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:workspaceId/audit-logs')
class AuditLogsController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  @RequireFeature('audit_log')
  list(@Workspace() ctx: WorkspaceContext, @ZQuery(auditLogQuerySchema) query: z.infer<typeof auditLogQuerySchema>) {
    return this.audit.list(ctx.workspaceId, query);
  }
}

@Global()
@Module({ controllers: [AuditLogsController], providers: [AuditService], exports: [AuditService] })
export class AuditLogsModule {}
