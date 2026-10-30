import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AppException } from '../common/errors';

/**
 * Validates that ids supplied by clients (assignees, linked records, stages) belong to the
 * caller's workspace. This is the core defence against cross-tenant references (IDOR).
 */
@Injectable()
export class WorkspaceRefsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertMember(workspaceId: string, userId: string | null | undefined, field = 'assignedToId'): Promise<void> {
    if (!userId) return;
    const membership = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true },
    });
    if (!membership) throw AppException.invalidReference(field, 'User is not a member of this workspace');
  }

  async assertCustomer(workspaceId: string, id: string | null | undefined, field = 'customerId'): Promise<void> {
    if (!id) return;
    const found = await this.prisma.customer.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!found) throw AppException.invalidReference(field, 'Customer not found in this workspace');
  }

  async assertLead(workspaceId: string, id: string | null | undefined, field = 'leadId'): Promise<void> {
    if (!id) return;
    const found = await this.prisma.lead.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!found) throw AppException.invalidReference(field, 'Lead not found in this workspace');
  }

  async assertDeal(workspaceId: string, id: string | null | undefined, field = 'dealId'): Promise<void> {
    if (!id) return;
    const found = await this.prisma.deal.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!found) throw AppException.invalidReference(field, 'Deal not found in this workspace');
  }

  /** Resolves a stage, enforcing that it belongs to the workspace and (optionally) the pipeline. */
  async getStage(workspaceId: string, stageId: string, pipelineId?: string) {
    const stage = await this.prisma.stage.findFirst({ where: { id: stageId, workspaceId } });
    if (!stage || (pipelineId && stage.pipelineId !== pipelineId)) {
      throw AppException.invalidReference('stageId', 'Stage not found in this pipeline');
    }
    return stage;
  }
}
