import type { Prisma } from '@prisma/client';
import type { Customer } from '@crm/shared';
import { userSummarySelect } from '../../common/pagination';

export const customerInclude = {
  assignedTo: { select: userSummarySelect },
  createdBy: { select: userSummarySelect },
} satisfies Prisma.CustomerInclude;

export type CustomerRow = Prisma.CustomerGetPayload<{ include: typeof customerInclude }>;

export function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    fullName: row.fullName,
    company: row.company,
    email: row.email,
    phone: row.phone,
    address: row.address,
    industry: row.industry,
    type: row.type,
    status: row.status,
    source: row.source,
    assignedTo: row.assignedTo,
    createdBy: row.createdBy,
    lastInteractionAt: row.lastInteractionAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
