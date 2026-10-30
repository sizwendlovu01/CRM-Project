import type { Prisma } from '@prisma/client';
import type { Deal } from '@crm/shared';
import { userSummarySelect } from '../../common/pagination';

export const dealInclude = {
  stage: { select: { id: true, name: true, type: true, color: true, probability: true } },
  customer: { select: { id: true, fullName: true, company: true } },
  assignedTo: { select: userSummarySelect },
  createdBy: { select: userSummarySelect },
} satisfies Prisma.DealInclude;

export type DealRow = Prisma.DealGetPayload<{ include: typeof dealInclude }>;

/** Probability used for weighting: won = 100, lost = 0, otherwise deal override or stage default. */
export function effectiveProbability(deal: { status: string; probability: number | null }, stageProbability: number): number {
  if (deal.status === 'WON') return 100;
  if (deal.status === 'LOST') return 0;
  return deal.probability ?? stageProbability;
}

export function weightedValue(value: number, probability: number): number {
  return Math.round(value * probability) / 100;
}

export function toDeal(row: DealRow, currency: string): Deal {
  return {
    id: row.id,
    title: row.title,
    value: row.value.toNumber(),
    currency,
    probability: row.probability,
    effectiveProbability: effectiveProbability(row, row.stage.probability),
    status: row.status,
    position: row.position,
    expectedCloseDate: row.expectedCloseDate?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    lostReason: row.lostReason,
    description: row.description,
    pipelineId: row.pipelineId,
    stageId: row.stageId,
    stage: row.stage,
    customer: row.customer,
    assignedTo: row.assignedTo,
    createdBy: row.createdBy,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
