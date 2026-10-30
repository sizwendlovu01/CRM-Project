import type { Plan } from './enums';

export const PLAN_FEATURES = ['csv_import', 'team_performance', 'advanced_analytics', 'audit_log'] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

export const USAGE_METRICS = ['members', 'customers', 'leads', 'deals', 'pipelines'] as const;
export type UsageMetric = (typeof USAGE_METRICS)[number];

export interface PlanDefinition {
  id: Plan;
  name: string;
  description: string;
  /** Display-only list price. Billing is simulated: no payment is ever collected. */
  monthlyPriceUsd: number;
  limits: Record<UsageMetric, number | null>;
  features: readonly PlanFeature[];
  highlights: readonly string[];
}

export const PLAN_DEFINITIONS: Record<Plan, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    description: 'Core CRM for individuals and very small teams.',
    monthlyPriceUsd: 0,
    limits: { members: 3, customers: 250, leads: 250, deals: 100, pipelines: 1 },
    features: [],
    highlights: ['Up to 3 members', '250 customers and 250 leads', '1 sales pipeline', 'Core dashboard'],
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    description: 'Growing teams that need more room and data import.',
    monthlyPriceUsd: 29,
    limits: { members: 10, customers: 2500, leads: 2500, deals: 1000, pipelines: 3 },
    features: ['csv_import'],
    highlights: ['Up to 10 members', '2,500 customers and leads', '3 pipelines', 'CSV import'],
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Growth',
    description: 'Advanced analytics and team performance for sales organisations.',
    monthlyPriceUsd: 79,
    limits: { members: 50, customers: 25000, leads: 25000, deals: 10000, pipelines: 10 },
    features: ['csv_import', 'team_performance', 'advanced_analytics'],
    highlights: ['Up to 50 members', '25,000 customers and leads', 'Team performance analytics', 'Advanced reporting'],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Unlimited scale with extended administration and audit logs.',
    monthlyPriceUsd: 199,
    limits: { members: null, customers: null, leads: null, deals: null, pipelines: null },
    features: ['csv_import', 'team_performance', 'advanced_analytics', 'audit_log'],
    highlights: ['Unlimited members and records', 'Unlimited pipelines', 'Audit log', 'Everything in Growth'],
  },
};

export function planHasFeature(plan: Plan, feature: PlanFeature): boolean {
  return PLAN_DEFINITIONS[plan].features.includes(feature);
}

/** Returns true when adding `increment` items would stay within the plan limit. */
export function withinLimit(plan: Plan, metric: UsageMetric, current: number, increment = 1): boolean {
  const limit = PLAN_DEFINITIONS[plan].limits[metric];
  return limit === null || current + increment <= limit;
}

/** Metrics whose current usage exceeds the limits of the target plan. */
export function exceededLimits(plan: Plan, usage: Record<UsageMetric, number>): UsageMetric[] {
  const limits = PLAN_DEFINITIONS[plan].limits;
  return (Object.keys(limits) as UsageMetric[]).filter((metric) => {
    const limit = limits[metric];
    return limit !== null && usage[metric] > limit;
  });
}
