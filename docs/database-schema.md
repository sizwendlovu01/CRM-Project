# Database schema

PostgreSQL 16, managed with Prisma migrations (`apps/api/prisma`). The model is in [`schema.prisma`](../apps/api/prisma/schema.prisma); hand-written hardening SQL is appended to the initial migration.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `users` | Accounts | unique `email`, Argon2id `passwordHash`, `emailVerifiedAt`, lockout counters |
| `sessions` | Server-side sessions | unique HMAC `tokenHash`, `expiresAt`, `revokedAt` |
| `auth_tokens` | Email verification / password reset | hashed token, `type`, `expiresAt`, `usedAt` (single use) |
| `workspaces` | Tenants | unique `slug`, `plan`, `subscriptionStatus`, `currentPeriodEnd`, `currency`, `timezone` |
| `memberships` | User-workspace role | unique `(workspaceId, userId)` |
| `invitations` | Team invites | hashed token, `role`, `expiresAt`, `acceptedAt`, `revokedAt` |
| `customers` | People / companies | `type`, `status`, `source`, `assignedToId`, `lastInteractionAt`, `archivedAt` |
| `leads` | Prospects | `status`, `priority`, `estimatedValue`, `nextFollowUpAt`, `convertedCustomerId` |
| `pipelines`, `stages` | Sales pipelines | stage `position`, `probability`, `type` (Open/Won/Lost) |
| `deals` | Opportunities | `value` decimal(14,2), `probability` override, `status`, `position`, `closedAt` |
| `tasks`, `task_comments` | Work items | `status`, `priority`, `dueAt`, `completedAt`, links to customer/deal/lead |
| `activities` | Calls, emails, meetings, notes, follow-ups | `occurredAt`, links to customer/lead/deal |
| `notes` | Notes on records | linked to customer/lead/deal |
| `notifications`, `notification_preferences` | In-app notifications | unique `(userId, dedupeKey)` |
| `audit_logs` | Administrative history | `action`, `entityType`, `metadata`, `ipAddress` |

Every tenant-owned table has a non-null `workspaceId` (`ON DELETE CASCADE` from `workspaces`) and an index starting with `workspaceId`. User references use `ON DELETE SET NULL` so history survives.

## Hand-written constraints

- `customers_workspace_email_unique`: unique `(workspaceId, lower(email))`.
- `invitations_pending_unique`: one pending invitation per email per workspace.
- `pipelines_one_default_per_workspace`: partial unique index.
- Checks: probabilities 0-100, non-negative values, activities/notes must link to a record, `leads.status = 'CONVERTED'` exactly when `convertedAt` is set.
- `pg_trgm` GIN indexes on customer name/company/email, lead name/company, deal title.

## Commands

```bash
pnpm db:deploy     # apply migrations
pnpm db:migrate    # create/apply migrations in development
pnpm db:seed       # demo data (refuses to run when NODE_ENV=production)
```

The seed creates "Northwind Traders" (Growth plan: ~70 customers, 42 leads, 48 deals, 36 tasks, 170 activities) and "Contoso Labs" (Free plan). Accounts `owner@`, `admin@`, `manager@`, `rep1@`, `rep2@`, `viewer@demo.crm.local` share `SEED_PASSWORD` (or a random password printed once).
