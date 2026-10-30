/**
 * Domain enums shared between the API (mirrored by Prisma enums) and the web client.
 * Values must stay identical to the Prisma schema enums.
 */

export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SALES_REPRESENTATIVE', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const PLANS = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'] as const;
export type Plan = (typeof PLANS)[number];

export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const CUSTOMER_TYPES = ['INDIVIDUAL', 'BUSINESS'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_STATUSES = ['PROSPECT', 'ACTIVE', 'INACTIVE', 'CHURNED'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const RECORD_SOURCES = [
  'WEBSITE',
  'REFERRAL',
  'EVENT',
  'COLD_OUTREACH',
  'SOCIAL_MEDIA',
  'PARTNER',
  'ADVERTISING',
  'LEAD_CONVERSION',
  'IMPORT',
  'OTHER',
] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DEAL_STATUSES = ['OPEN', 'WON', 'LOST'] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const STAGE_TYPES = ['OPEN', 'WON', 'LOST'] as const;
export type StageType = (typeof STAGE_TYPES)[number];

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'FOLLOW_UP'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'WORKSPACE_INVITATION',
  'LEAD_ASSIGNED',
  'DEAL_ASSIGNED',
  'DEAL_UPDATED',
  'TASK_DUE_SOON',
  'TASK_OVERDUE',
  'CUSTOMER_ACTIVITY',
  'MEMBER_JOINED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Human readable labels for enum values, used by the UI and CSV exports. */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
