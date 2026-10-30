# Architecture

## Overview

```
Browser --> Next.js (web, :3000) --/api/* rewrite--> NestJS API (:4000) --> PostgreSQL
                                                         |                  Redis (BullMQ, rate limits)
                                                         +--> SMTP (Mailpit locally)
```

- The browser only talks to the Next.js origin. `/api/*` is proxied to the API, so the session cookie is first-party (`SameSite=Lax`, `HttpOnly`) and no CORS is needed in production.
- The frontend is a client-rendered App Router application using TanStack Query for server state. The API is the single source of truth for authentication and authorisation.
- `packages/shared` holds the Zod schemas, enums, permission matrix and plan definitions. The API validates every request body/query with these schemas and the web forms reuse them through React Hook Form.

## Backend (NestJS)

| Layer | Responsibility |
| --- | --- |
| `AuthGuard` (global) | Resolves the session cookie (HMAC-hashed token lookup, sliding expiry) and rejects unauthenticated access to non-public routes |
| `CsrfMiddleware` | Signed double-submit token required on every state-changing request |
| `ThrottlerGuard` (global) | Per-IP rate limits (Redis-backed when available), stricter on credential endpoints |
| `WorkspaceGuard` | For `/workspaces/:workspaceId/**`: verifies membership (404 otherwise), role permissions (`@RequirePermissions`) and plan features (`@RequireFeature`), then attaches a `WorkspaceContext` |
| Services | Business logic. Every query filters by `ctx.workspaceId`; foreign ids supplied by clients are validated by `WorkspaceRefsService` |
| `AllExceptionsFilter` | Consistent JSON errors with stable codes; never leaks stack traces or database messages |

### Background jobs

`JobsService` uses BullMQ when `REDIS_URL` is set (retries with exponential backoff, a 15-minute scheduler for task reminders). Without Redis it runs jobs in-process with the same retry policy; tests run jobs inline. Email is always sent from a job so slow SMTP never blocks a request.

### Record-level authorisation

Roles map to permissions in `packages/shared/src/permissions.ts`. Sales representatives read workspace records but only modify records assigned to or created by them, cannot reassign records, and see analytics scoped to their own records. Managers and above modify and assign everything. Viewers are read-only. Role changes follow a strict hierarchy; ownership transfer is owner-only; billing is owner-only.

### Data integrity

- Lead conversion runs in one transaction with `SELECT ... FOR UPDATE` on the lead, so concurrent requests cannot convert twice (covered by a concurrency test). An existing customer with the same email is reused.
- Deal moves lock the affected stage rows and compact positions in both columns.
- Database constraints back the application rules (see [database-schema.md](database-schema.md)).

## Frontend (Next.js)

- `app/w/[slug]/layout.tsx` resolves the workspace from the user's memberships and provides `useWorkspace()` (workspace, members, `can()`, `hasFeature()`). The UI hides actions a role cannot perform; the API enforces them regardless.
- `lib/api.ts` is the single fetch wrapper: same-origin cookies, CSRF header, typed `ApiError`, friendly network errors, CSRF auto-refresh and a global 401 event that redirects to sign-in.
- Global mutation error toasts, route error boundaries, skeleton loading states, empty states and retryable error states on data views.
- Design tokens (light/dark) live in `globals.css`. Chart colours were checked with a palette validator for colour-vision-deficiency separation and contrast; every chart has a table view.

## Performance

- Offset pagination with indexes on `(workspaceId, createdAt)` and main filter columns; page size capped at 100.
- Trigram GIN indexes for case-insensitive search.
- Analytics use aggregate/`GROUP BY` queries plus `generate_series` for time buckets; team performance uses a fixed number of grouped queries (no N+1).
- Session "last seen" writes throttled to once per 5 minutes; TanStack Query caching with `keepPreviousData`; debounced search.
- Largest route bundle is about 420 kB first-load JS (dashboard with charts); shared JS is 103 kB.

## Decisions and trade-offs

- **PostgreSQL row-level security** was considered. It needs a per-transaction `SET app.workspace_id` around every Prisma query, adding latency and complexity with pooled connections. Isolation is instead enforced by one guard plus mandatory `workspaceId` filters and verified by automated cross-tenant tests. RLS remains a documented future hardening step.
- **Customers model both people and companies** (`type` Individual/Business plus `company`) instead of separate organisations/contacts modules.
- **OpenTelemetry tracing** is not wired in. Metrics are exported in Prometheus format and logs are structured JSON with request ids.
- **Analytics periods are bucketed in UTC.**
