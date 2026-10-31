# Testing report

Executed on 30 October 2026 and re-run on 31 October 2026 (Vercel deployment changes) on Windows 11 (Node.js 22.14, PostgreSQL 16.15 and Redis 7.0.15 in WSL, Mailpit 1.32, Chromium via Playwright 1.64).

| Suite | Tool | Tests | Passed | Failed | Skipped |
| --- | --- | ---: | ---: | ---: | ---: |
| Shared unit (permissions, plans, schemas, CSV) | Vitest | 16 | 16 | 0 | 0 |
| API unit (crypto, CSV parsing, deal weighting, overdue logic, analytics ranges, error filter, trusted proxy IP) | Jest | 27 | 27 | 0 | 0 |
| Web unit (formatters, API client, Kanban state) | Vitest | 14 | 14 | 0 | 0 |
| API integration (real PostgreSQL, full HTTP stack) | Jest + Supertest | 45 | 45 | 0 | 0 |
| End-to-end (real browser against running stack) | Playwright | 19 | 19 | 0 | 0 |
| **Total** | | **121** | **121** | **0** | **0** |

Also run: TypeScript strict type checks (all packages), ESLint (all packages, 0 problems), production builds of API and web, migration deploy against a fresh database, `pnpm audit --prod` (0 high/critical; 1 moderate documented in security.md).

## Vercel deployment verification (31 October 2026)

No real Vercel deployment was made (that needs your Vercel account). Instead:

- **Production build simulation.** `vercel build --prod` (Vercel CLI 65.9.0) ran for both projects on Linux (official Node.js 22.14 in WSL Ubuntu 24.04) from a clean copy of the repository, using the committed `vercel.json` files. Install, build, the migration step (against a local PostgreSQL) and function bundling all completed.
- **API bundle.** The function bundle is 67 MB (the limit is 250 MB). It contains the Amazon Linux Prisma engine, the argon2 Linux binary, the compiled API and the shared package. Copied to an isolated folder and booted with no access to the repository, it served `/health`, signed in a seeded user, returned `/auth/me` and answered 404 for unknown routes.
- **Web bundle.** The `/api/*` rewrite points at `API_INTERNAL_URL`. A build without that variable stops with a clear error.
- **Serverless runtime.** The full Playwright suite (19/19) passed with the API served through `dist/serverless.js` in production mode, with no Redis (in-process jobs kept alive with `waitUntil`) and `VERCEL=1`. Email flows (verification, reset, invitation) were included.
- **Per-client rate limits through the proxy.** 10 password-reset requests from one forwarded IP passed and the 11th returned 429, while a second IP was still allowed. A forged proxy secret sent straight to the API was ignored.
- **Cron endpoint.** `/api/v1/cron/reminders` returns 401 without the bearer secret and runs the reminder scan with it.

## Integration coverage (`apps/api/test`)

- **auth** - registration (workspace + default pipeline created, Argon2id hash), duplicate email, validation errors, login/logout, generic credential errors, forged cookies, server-side expiry, CSRF missing/forged, account lockout, password reset (single-use token, session revocation, expired token), email verification, profile update, password change revoking other sessions.
- **tenancy** - workspace hidden from non-members (404) for every module; IDOR attempts using another tenant's ids for read/update/delete/convert/move; cross-tenant references (customer, stage, deal, assignee) rejected; list/search/analytics scoping; notification isolation.
- **rbac** - viewer read-only, rep auto-assignment and ownership rules, manager reassignment, billing owner-only, role hierarchy, invitation preview/accept/wrong-account/revoke, duplicate member invite, member removal unassigning records, leave, ownership transfer.
- **crm** - customer CRUD, search, filter, sort, pagination, invalid query, archive/restore/delete, duplicate detection (email and normalised phone), CSV export formula neutralisation, CSV import with duplicates and row errors, file-type checks, plan gating; lead conversion with deal, **concurrent double-conversion (3 parallel requests -> exactly one succeeds)**, reuse of existing customer; deal moves with ordering, weighted values, won/reopen; stage CRUD/reorder/delete-with-move; tasks with notifications, overdue filter, completion, comments; activities updating last interaction; chronological timeline.
- **analytics-billing** - exact KPI values from known data, rep-scoped analytics, team performance gating, date-range validation, member and record plan limits, simulated upgrades, downgrade blocking, audit-log feature gating, notification list/count/read/read-all/preferences, task-assignment email, reminder job de-duplication, invitation notifications.
- **rate-limit** - 429 after the configured number of login attempts.

## End-to-end coverage (`apps/web/e2e`)

| Requirement | Test |
| --- | --- |
| Registration, login, logout, wrong password | `auth.spec` registers, logs out, rejects bad credentials and logs back in |
| Form validation | `auth.spec` validates the registration form |
| Password reset | `auth.spec` reset via the link delivered to Mailpit |
| Expired/unauthenticated sessions | `auth.spec` redirect and server-side logout tests |
| Workspace creation | global setup and every registration |
| Workspace switching, invitations, member management, role changes | `team-settings.spec` invite -> accept via email link -> switch -> change role -> remove |
| Customer create/edit/search/archive/delete | `crm.spec` |
| CSV import and export | `crm.spec` |
| Lead creation and conversion | `crm.spec` |
| Deal creation, pipeline drag-and-drop, persistence | `crm.spec` (mouse drag, API check, reload, keyboard-accessible move menu) |
| Task creation, completion, comments; activity recording; notes | `crm.spec` |
| Dashboard analytics from real data | `crm.spec` compares KPI tile with the API |
| Notifications | `team-settings.spec` notification centre |
| Workspace settings, profile, notification preferences | `team-settings.spec` |
| Subscription usage limits | `team-settings.spec` Free plan member limit and CSV import gate |
| Permission restrictions | `team-settings.spec` viewer UI + API 403 |
| Cross-tenant access prevention | `team-settings.spec` API and UI checks |
| Mobile responsiveness | `mobile.spec` (Pixel 7 profile, no horizontal overflow, nav drawer, forms, Kanban) |

Task assignment and deal assignment E2E coverage is through the forms (assignee defaults/selection); assignment rules themselves are covered by integration tests.

## Defects found and fixed during testing

- Notification de-duplication logged noisy Prisma errors on expected duplicates -> switched to `createMany({ skipDuplicates })`.
- Timeline endpoint returned 400 instead of 404 for another tenant's customer -> now 404.
- Required-field asterisk was part of the accessible label name -> moved outside the `<label>`.
- List toolbars squeezed the search box at medium widths -> filters now wrap.
- Shared unit test imported `ROLES` from the wrong module.
- Rebuilding the web app while the old server ran served stale chunks (operational; the start scripts stop the server before building).

## Not covered / limitations

- Docker images were not built locally (Docker is not installed on the development machine); the CI workflow builds them.
- The GitHub Actions workflow has not run yet because the repository has not been pushed.
- No load testing; database-failure behaviour is covered by unit tests of the error filter (503 mapping) rather than by stopping the database during E2E.
- Visual review was done manually on desktop, dark mode and a 390 px phone viewport; no automated visual regression.

## How to run

```bash
pnpm test:unit
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/crm_test pnpm test:integration
pnpm test:e2e      # with web on :3000, API on :4000, Mailpit on :8025 and the demo seed loaded
```
