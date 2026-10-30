import type { Paginated } from '@crm/shared';

export function pageArgs(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(data: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { data, meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

/** Resolves the "me" / "unassigned" shortcuts used by list filters. */
export function assigneeFilter(value: string | undefined, userId: string): { assignedToId?: string | null } {
  if (!value) return {};
  if (value === 'me') return { assignedToId: userId };
  if (value === 'unassigned') return { assignedToId: null };
  return { assignedToId: value };
}

export const userSummarySelect = { id: true, name: true, email: true } as const;

export function decimalToNumber(value: { toNumber(): number } | null | undefined): number | null {
  return value === null || value === undefined ? null : value.toNumber();
}
