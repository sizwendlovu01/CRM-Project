import { Plan, Prisma, StageType } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { slugify } from '../../common/crypto';

export const DEFAULT_STAGES: { name: string; probability: number; type: StageType; color: string }[] = [
  { name: 'Lead In', probability: 10, type: 'OPEN', color: '#64748b' },
  { name: 'Qualified', probability: 25, type: 'OPEN', color: '#0ea5e9' },
  { name: 'Proposal', probability: 50, type: 'OPEN', color: '#6366f1' },
  { name: 'Negotiation', probability: 75, type: 'OPEN', color: '#f59e0b' },
  { name: 'Closed Won', probability: 100, type: 'WON', color: '#10b981' },
  { name: 'Closed Lost', probability: 0, type: 'LOST', color: '#ef4444' },
];

async function uniqueSlug(tx: Prisma.TransactionClient, name: string): Promise<string> {
  const base = slugify(name);
  const existing = await tx.workspace.findUnique({ where: { slug: base }, select: { id: true } });
  if (!existing) return base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base.slice(0, 33)}-${randomBytes(3).toString('hex')}`;
    const taken = await tx.workspace.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base.slice(0, 28)}-${randomBytes(6).toString('hex')}`;
}

/**
 * Creates a workspace with its owner membership and a default sales pipeline.
 * Must run inside a transaction so a partially-created tenant can never exist.
 */
export async function createWorkspaceWithDefaults(
  tx: Prisma.TransactionClient,
  ownerId: string,
  name: string,
  options: { plan?: Plan; currency?: string } = {},
) {
  const workspace = await tx.workspace.create({
    data: {
      name,
      slug: await uniqueSlug(tx, name),
      ownerId,
      plan: options.plan ?? 'FREE',
      currency: options.currency ?? 'USD',
      subscriptionStatus: 'ACTIVE',
      memberships: { create: { userId: ownerId, role: 'OWNER' } },
    },
  });

  await tx.pipeline.create({
    data: {
      workspaceId: workspace.id,
      name: 'Sales Pipeline',
      isDefault: true,
      stages: {
        create: DEFAULT_STAGES.map((stage, position) => ({ ...stage, position, workspaceId: workspace.id })),
      },
    },
  });

  return workspace;
}
