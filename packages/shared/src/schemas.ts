import { z } from 'zod';
import {
  ACTIVITY_TYPES,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  LEAD_STATUSES,
  NOTIFICATION_TYPES,
  PLANS,
  PRIORITIES,
  RECORD_SOURCES,
  ROLES,
  STAGE_TYPES,
  TASK_STATUSES,
} from './enums';

/* ------------------------------------------------------------------ */
/* Primitive helpers                                                   */
/* ------------------------------------------------------------------ */

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export const optionalText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullish());

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(254)
  .email('Enter a valid email address');

export const optionalEmail = z.preprocess(emptyToNull, emailSchema.nullish());

const PHONE_PATTERN = /^[+()\-.\s\d]{5,30}$/;
export const optionalPhone = z.preprocess(
  emptyToNull,
  z.string().trim().regex(PHONE_PATTERN, 'Enter a valid phone number').nullish(),
);

/** Database ids are UUIDs. */
export const idSchema = z.string().uuid('Invalid identifier');
export const optionalId = z.preprocess(emptyToNull, idSchema.nullish());

export const optionalDate = z.preprocess(emptyToNull, z.coerce.date().nullish());

export const optionalMoney = z.preprocess(
  emptyToNull,
  z.coerce.number().min(0, 'Must be zero or more').max(1_000_000_000_000).nullish(),
);

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

/* ------------------------------------------------------------------ */
/* Auth and profile                                                    */
/* ------------------------------------------------------------------ */

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: emailSchema,
  password: passwordSchema,
  workspaceName: z.string().trim().min(2, 'Workspace name must be at least 2 characters').max(80),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  jobTitle: optionalText(100),
  phone: optionalPhone,
  timezone: z.string().trim().min(1).max(64).default('UTC'),
});

/* ------------------------------------------------------------------ */
/* Workspaces, members and billing                                     */
/* ------------------------------------------------------------------ */

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Workspace name must be at least 2 characters').max(80),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  industry: optionalText(100),
  timezone: z.string().trim().min(1).max(64),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter ISO currency code'),
});

export const INVITABLE_ROLES = ROLES.filter((role) => role !== 'OWNER') as Exclude<
  (typeof ROLES)[number],
  'OWNER'
>[];

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['ADMIN', 'MANAGER', 'SALES_REPRESENTATIVE', 'VIEWER']),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'SALES_REPRESENTATIVE', 'VIEWER']),
});

export const transferOwnershipSchema = z.object({ userId: idSchema });

export const changePlanSchema = z.object({ plan: z.enum(PLANS) });

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

const customerFields = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(160),
  company: optionalText(160),
  email: optionalEmail,
  phone: optionalPhone,
  address: optionalText(500),
  industry: optionalText(100),
  type: z.enum(CUSTOMER_TYPES),
  status: z.enum(CUSTOMER_STATUSES),
  source: z.enum(RECORD_SOURCES),
  assignedToId: optionalId,
});

export const createCustomerSchema = customerFields.extend({
  type: z.enum(CUSTOMER_TYPES).default('BUSINESS'),
  status: z.enum(CUSTOMER_STATUSES).default('PROSPECT'),
  source: z.enum(RECORD_SOURCES).default('OTHER'),
});

export const updateCustomerSchema = customerFields.partial();

export const CUSTOMER_SORT_FIELDS = ['createdAt', 'fullName', 'company', 'status', 'lastInteractionAt'] as const;

export const customerListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(CUSTOMER_STATUSES).optional(),
  type: z.enum(CUSTOMER_TYPES).optional(),
  source: z.enum(RECORD_SOURCES).optional(),
  assignedToId: z.union([idSchema, z.literal('me'), z.literal('unassigned')]).optional(),
  archived: booleanQuery,
  sortBy: z.enum(CUSTOMER_SORT_FIELDS).default('createdAt'),
});

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

const leadFields = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(160),
  company: optionalText(160),
  email: optionalEmail,
  phone: optionalPhone,
  jobTitle: optionalText(100),
  source: z.enum(RECORD_SOURCES),
  status: z.enum(LEAD_STATUSES).exclude(['CONVERTED']),
  priority: z.enum(PRIORITIES),
  estimatedValue: optionalMoney,
  assignedToId: optionalId,
  nextFollowUpAt: optionalDate,
  description: optionalText(5000),
});

export const createLeadSchema = leadFields.extend({
  source: z.enum(RECORD_SOURCES).default('OTHER'),
  status: z.enum(LEAD_STATUSES).exclude(['CONVERTED']).default('NEW'),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
});

export const updateLeadSchema = leadFields.partial();

export const LEAD_SORT_FIELDS = ['createdAt', 'fullName', 'company', 'status', 'priority', 'nextFollowUpAt'] as const;

export const leadListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(LEAD_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  source: z.enum(RECORD_SOURCES).optional(),
  assignedToId: z.union([idSchema, z.literal('me'), z.literal('unassigned')]).optional(),
  archived: booleanQuery,
  sortBy: z.enum(LEAD_SORT_FIELDS).default('createdAt'),
});

export const convertLeadSchema = z.object({
  customerStatus: z.enum(CUSTOMER_STATUSES).default('ACTIVE'),
  createDeal: z.boolean().default(false),
  dealTitle: optionalText(200),
  dealValue: optionalMoney,
  pipelineId: optionalId,
});

/* ------------------------------------------------------------------ */
/* Pipelines and deals                                                 */
/* ------------------------------------------------------------------ */

export const createPipelineSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
});
export const updatePipelineSchema = createPipelineSchema.extend({ isDefault: z.boolean().optional() }).partial();

const stageFields = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  probability: z.coerce.number().int().min(0).max(100),
  type: z.enum(STAGE_TYPES),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour such as #4f46e5')
    .optional(),
});
export const createStageSchema = stageFields.extend({ type: z.enum(STAGE_TYPES).default('OPEN') });
export const updateStageSchema = stageFields.partial();
export const reorderStagesSchema = z.object({ stageIds: z.array(idSchema).min(1).max(30) });
export const deleteStageQuerySchema = z.object({ moveDealsToStageId: idSchema.optional() });

const dealFields = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  value: z.coerce.number().min(0, 'Value must be zero or more').max(1_000_000_000_000),
  pipelineId: idSchema,
  stageId: idSchema,
  customerId: optionalId,
  assignedToId: optionalId,
  expectedCloseDate: optionalDate,
  probability: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(100).nullish()),
  description: optionalText(5000),
  lostReason: optionalText(500),
});
export const createDealSchema = dealFields.extend({ value: dealFields.shape.value.default(0) });
export const updateDealSchema = dealFields.omit({ pipelineId: true, stageId: true }).partial();
export const moveDealSchema = z.object({
  stageId: idSchema,
  /** Zero-based position within the target stage. Appends when omitted. */
  position: z.number().int().min(0).max(100_000).optional(),
});

export const DEAL_SORT_FIELDS = ['createdAt', 'title', 'value', 'expectedCloseDate'] as const;

export const dealListQuerySchema = paginationQuerySchema.extend({
  pipelineId: idSchema.optional(),
  stageId: idSchema.optional(),
  status: z.enum(['OPEN', 'WON', 'LOST']).optional(),
  assignedToId: z.union([idSchema, z.literal('me'), z.literal('unassigned')]).optional(),
  customerId: idSchema.optional(),
  minValue: z.coerce.number().min(0).optional(),
  maxValue: z.coerce.number().min(0).optional(),
  archived: booleanQuery,
  sortBy: z.enum(DEAL_SORT_FIELDS).default('createdAt'),
});

export const boardQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  assignedToId: z.union([idSchema, z.literal('me'), z.literal('unassigned')]).optional(),
});

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

const taskFields = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: optionalText(5000),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  dueAt: optionalDate,
  assignedToId: optionalId,
  customerId: optionalId,
  dealId: optionalId,
  leadId: optionalId,
});
export const createTaskSchema = taskFields.extend({
  status: z.enum(TASK_STATUSES).default('TODO'),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
});
export const updateTaskSchema = taskFields.partial();

export const TASK_SORT_FIELDS = ['createdAt', 'dueAt', 'priority', 'title'] as const;

export const taskListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedToId: z.union([idSchema, z.literal('me'), z.literal('unassigned')]).optional(),
  due: z.enum(['overdue', 'today', 'week', 'none']).optional(),
  customerId: idSchema.optional(),
  dealId: idSchema.optional(),
  leadId: idSchema.optional(),
  sortBy: z.enum(TASK_SORT_FIELDS).default('dueAt'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
});

/* ------------------------------------------------------------------ */
/* Activities and notes                                                */
/* ------------------------------------------------------------------ */

export const createActivitySchema = z
  .object({
    type: z.enum(ACTIVITY_TYPES),
    subject: z.string().trim().min(1, 'Subject is required').max(200),
    description: optionalText(5000),
    occurredAt: z.preprocess(emptyToNull, z.coerce.date().nullish()),
    durationMinutes: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(1440).nullish()),
    outcome: optionalText(200),
    customerId: optionalId,
    leadId: optionalId,
    dealId: optionalId,
  })
  .refine((value) => Boolean(value.customerId || value.leadId || value.dealId), {
    message: 'Link the activity to a customer, lead or deal',
    path: ['customerId'],
  });

export const activityListQuerySchema = paginationQuerySchema.extend({
  type: z.enum(ACTIVITY_TYPES).optional(),
  customerId: idSchema.optional(),
  leadId: idSchema.optional(),
  dealId: idSchema.optional(),
  userId: idSchema.optional(),
});

export const createNoteSchema = z
  .object({
    body: z.string().trim().min(1, 'Note cannot be empty').max(10000),
    customerId: optionalId,
    leadId: optionalId,
    dealId: optionalId,
  })
  .refine((value) => Boolean(value.customerId || value.leadId || value.dealId), {
    message: 'Link the note to a customer, lead or deal',
    path: ['customerId'],
  });

/* ------------------------------------------------------------------ */
/* Notifications, analytics, search                                    */
/* ------------------------------------------------------------------ */

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: booleanQuery,
});

export const updateNotificationPreferencesSchema = z.object({
  preferences: z
    .array(z.object({ type: z.enum(NOTIFICATION_TYPES), inApp: z.boolean(), email: z.boolean() }))
    .min(1)
    .max(NOTIFICATION_TYPES.length),
});

export const analyticsQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: '"from" must be before "to"',
    path: ['from'],
  });

export const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(100) });

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  entityType: z.string().max(50).optional(),
});

/* ------------------------------------------------------------------ */
/* Inferred types                                                      */
/* ------------------------------------------------------------------ */

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type MoveDealInput = z.infer<typeof moveDealSchema>;
export type DealListQuery = z.infer<typeof dealListQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
