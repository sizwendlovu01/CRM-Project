# API documentation

Interactive OpenAPI docs are served at **`/api/docs`** (JSON at `/api/docs-json`) when `SWAGGER_ENABLED` is true (default outside production). Request schemas are generated from the shared Zod schemas.

## Conventions

- Base path `/api/v1`. Health: `/health`, `/health/live`. Metrics: `/metrics` (Prometheus; not exposed through the web proxy).
- `POST /api/v1/auth/login` sets the `crm_session` HttpOnly cookie.
- CSRF: every POST/PUT/PATCH/DELETE must echo the `crm_csrf` cookie in the `X-CSRF-Token` header. `GET /api/v1/auth/csrf` issues the cookie.
- Errors: `{ statusCode, error, message, code, details?, requestId }`. Codes include `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_CUSTOMER`, `INVALID_REFERENCE`, `PLAN_LIMIT_REACHED` (402), `PLAN_FEATURE_UNAVAILABLE` (402), `LEAD_ALREADY_CONVERTED`, `RATE_LIMITED` (429), `ACCOUNT_LOCKED`.
- Lists: `?page&pageSize&q&sortBy&sortDir` return `{ data, meta: { page, pageSize, total, totalPages } }`.
- Workspace routes are under `/workspaces/:workspaceId`; non-members get 404.

## Endpoints

| Area | Endpoints |
| --- | --- |
| Auth | `GET auth/csrf`, `POST auth/register`, `POST auth/login`, `POST auth/logout`, `GET auth/me`, `POST auth/forgot-password`, `POST auth/reset-password`, `POST auth/verify-email`, `POST auth/resend-verification` |
| Profile | `PATCH users/me`, `POST users/me/password`, `GET users/me/sessions`, `DELETE users/me/sessions/:id`, `POST users/me/sessions/revoke-others` |
| Workspaces | `GET/POST workspaces`, `GET/PATCH workspaces/:id`, `POST workspaces/:id/delete`, `POST workspaces/:id/leave`, `POST workspaces/:id/transfer-ownership` |
| Members | `GET workspaces/:id/members`, `PATCH/DELETE workspaces/:id/members/:memberId` |
| Invitations | `GET/POST workspaces/:id/invitations`, `POST .../invitations/:invId/resend`, `DELETE .../invitations/:invId`, `GET invitations/:token` (public), `POST invitations/:token/accept` |
| Customers | `GET/POST customers`, `GET/PATCH/DELETE customers/:id`, `POST customers/:id/archive`, `POST customers/:id/restore`, `GET customers/export`, `POST customers/import` (multipart `file`), `GET customers/duplicates`, `GET customers/:id/timeline` |
| Leads | `GET/POST leads`, `GET/PATCH/DELETE leads/:id`, `POST leads/:id/convert`, `POST leads/:id/archive`, `POST leads/:id/restore` |
| Pipelines | `GET/POST pipelines`, `GET/PATCH/DELETE pipelines/:pid`, `POST pipelines/:pid/stages`, `PUT pipelines/:pid/stages/order`, `PATCH/DELETE pipelines/:pid/stages/:sid`, `GET pipelines/:pid/board` |
| Deals | `GET/POST deals`, `GET/PATCH/DELETE deals/:id`, `POST deals/:id/move`, `POST deals/:id/archive`, `POST deals/:id/restore` |
| Tasks | `GET/POST tasks`, `GET/PATCH/DELETE tasks/:id`, `GET/POST tasks/:id/comments`, `DELETE tasks/:id/comments/:cid` |
| Activities and notes | `GET/POST activities`, `DELETE activities/:id`, `GET notes`, `POST notes`, `DELETE notes/:id` |
| Analytics | `GET analytics/overview?from&to`, `GET search?q` |
| Notifications | `GET notifications`, `GET notifications/unread-count`, `POST notifications/read-all`, `POST notifications/:id/read`, `POST notifications/:id/unread`, `GET/PUT notifications/preferences` |
| Billing (simulated) | `GET plans`, `GET workspaces/:id/subscription`, `POST workspaces/:id/subscription/change-plan` |
| Audit | `GET workspaces/:id/audit-logs` (Enterprise plan) |
