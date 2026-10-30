import type {
  ActivityType,
  CustomerStatus,
  CustomerType,
  DealStatus,
  LeadStatus,
  NotificationType,
  Plan,
  Priority,
  RecordSource,
  Role,
  StageType,
  SubscriptionStatus,
  TaskStatus,
} from './enums';
import type { Permission } from './permissions';
import type { PlanFeature, UsageMetric } from './plans';

/** API response DTOs. Dates are serialised as ISO-8601 strings. */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  details?: { path: string; message: string }[];
  requestId?: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface MembershipSummary {
  role: Role;
  workspace: { id: string; name: string; slug: string; plan: Plan };
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  jobTitle: string | null;
  phone: string | null;
  timezone: string;
  createdAt: string;
  memberships: MembershipSummary[];
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: string | null;
  industry: string | null;
  timezone: string;
  currency: string;
  createdAt: string;
  role: Role;
  permissions: Permission[];
  features: PlanFeature[];
}

export interface Member {
  id: string;
  role: Role;
  joinedAt: string;
  user: UserSummary & { jobTitle: string | null };
}

export interface InvitationDto {
  id: string;
  email: string;
  role: Role;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  invitedBy: UserSummary | null;
}

export interface InvitationPreview {
  workspaceName: string;
  email: string;
  role: Role;
  invitedBy: string | null;
  expiresAt: string;
}

export interface Customer {
  id: string;
  fullName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  industry: string | null;
  type: CustomerType;
  status: CustomerStatus;
  source: RecordSource;
  assignedTo: UserSummary | null;
  createdBy: UserSummary | null;
  lastInteractionAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends Customer {
  stats: { openDeals: number; openDealValue: number; wonDealValue: number; openTasks: number };
}

export interface DuplicateGroup {
  reason: 'email' | 'phone' | 'name_company';
  value: string;
  customers: Pick<Customer, 'id' | 'fullName' | 'company' | 'email' | 'phone' | 'createdAt'>[];
}

export interface ImportResult {
  totalRows: number;
  created: number;
  skippedDuplicates: number;
  errors: { row: number; message: string }[];
}

export interface Lead {
  id: string;
  fullName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  source: RecordSource;
  status: LeadStatus;
  priority: Priority;
  estimatedValue: number | null;
  description: string | null;
  nextFollowUpAt: string | null;
  assignedTo: UserSummary | null;
  createdBy: UserSummary | null;
  convertedAt: string | null;
  convertedCustomerId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConvertLeadResult {
  lead: Lead;
  customerId: string;
  dealId: string | null;
}

export interface Stage {
  id: string;
  pipelineId: string;
  name: string;
  position: number;
  probability: number;
  type: StageType;
  color: string;
  dealCount?: number;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  stages: Stage[];
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  probability: number | null;
  effectiveProbability: number;
  status: DealStatus;
  position: number;
  expectedCloseDate: string | null;
  closedAt: string | null;
  lostReason: string | null;
  description: string | null;
  pipelineId: string;
  stageId: string;
  stage: Pick<Stage, 'id' | 'name' | 'type' | 'color' | 'probability'>;
  customer: Pick<Customer, 'id' | 'fullName' | 'company'> | null;
  assignedTo: UserSummary | null;
  createdBy: UserSummary | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumn {
  stage: Stage;
  deals: Deal[];
  totalValue: number;
  weightedValue: number;
}

export interface Board {
  pipeline: Pipeline;
  columns: BoardColumn[];
  totals: { openValue: number; weightedValue: number; openDeals: number; wonValue: number };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueAt: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  assignedTo: UserSummary | null;
  createdBy: UserSummary | null;
  customer: { id: string; fullName: string } | null;
  deal: { id: string; title: string } | null;
  lead: { id: string; fullName: string } | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  body: string;
  author: UserSummary | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  description: string | null;
  occurredAt: string;
  durationMinutes: number | null;
  outcome: string | null;
  user: UserSummary | null;
  customer: { id: string; fullName: string } | null;
  lead: { id: string; fullName: string } | null;
  deal: { id: string; title: string } | null;
  createdAt: string;
}

export interface Note {
  id: string;
  body: string;
  author: UserSummary | null;
  customerId: string | null;
  leadId: string | null;
  dealId: string | null;
  createdAt: string;
}

export type TimelineItem =
  | { kind: 'activity'; at: string; activity: Activity }
  | { kind: 'note'; at: string; note: Note }
  | { kind: 'task'; at: string; task: Pick<Task, 'id' | 'title' | 'status' | 'dueAt' | 'completedAt'> }
  | { kind: 'deal'; at: string; deal: Pick<Deal, 'id' | 'title' | 'value' | 'status'> };

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  workspaceId: string | null;
}

export interface NotificationPreference {
  type: NotificationType;
  inApp: boolean;
  email: boolean;
}

export interface UsageSummary {
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: string | null;
  usage: Record<UsageMetric, { used: number; limit: number | null }>;
  features: PlanFeature[];
  billingMode: 'simulated';
}

export interface TimeSeriesPoint {
  period: string;
  value: number;
}

export interface RepPerformance {
  user: UserSummary;
  dealsWon: number;
  revenue: number;
  openPipeline: number;
  activities: number;
  tasksCompleted: number;
  leadsConverted: number;
}

export interface AnalyticsOverview {
  range: { from: string; to: string };
  currency: string;
  kpis: {
    totalCustomers: number;
    newCustomers: number;
    totalLeads: number;
    newLeads: number;
    qualifiedLeads: number;
    convertedLeads: number;
    leadConversionRate: number;
    activeDeals: number;
    pipelineValue: number;
    weightedPipelineValue: number;
    closedWonDeals: number;
    closedLostDeals: number;
    revenue: number;
    winRate: number;
    completedTasks: number;
    overdueTasks: number;
    openTasks: number;
    activities: number;
  };
  revenueByPeriod: TimeSeriesPoint[];
  customersByPeriod: TimeSeriesPoint[];
  leadsByStatus: { status: LeadStatus; count: number }[];
  leadConversionByPeriod: { period: string; created: number; converted: number }[];
  pipelineByStage: { stageId: string; stage: string; type: StageType; count: number; value: number; weightedValue: number }[];
  activitiesByType: { type: ActivityType; count: number }[];
  activitiesByPeriod: TimeSeriesPoint[];
  teamPerformance: RepPerformance[] | null;
}

export interface SearchResults {
  customers: Pick<Customer, 'id' | 'fullName' | 'company' | 'email'>[];
  leads: Pick<Lead, 'id' | 'fullName' | 'company' | 'status'>[];
  deals: Pick<Deal, 'id' | 'title' | 'value' | 'status'>[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  actor: UserSummary | null;
  ipAddress: string | null;
  createdAt: string;
}
