# Security

Reviewed against the OWASP Top 10 (2021) and ASVS guidance.

| Area | Controls | Verified by |
| --- | --- | --- |
| Authentication | Argon2id (19 MiB, t=2, p=1); generic credential errors with dummy-hash timing equalisation; lockout after 10 failures for 15 minutes; per-IP throttling on register/login/reset (10/min default) | `auth.int-spec`, `rate-limit.int-spec` |
| Sessions | 256-bit random tokens stored as HMAC-SHA256 hashes; HttpOnly, SameSite=Lax, Secure in production; sliding expiry (7 days); revocation on logout, password change and reset; session list and remote revoke | `auth.int-spec` |
| CSRF | Signed double-submit token required on every state-changing request, plus SameSite cookies and JSON-only bodies | `auth.int-spec` (forged/missing token -> 403) |
| Authorisation / IDOR | `WorkspaceGuard` membership check on every tenant route (404 for non-members); role permission matrix; record ownership rules; every query scoped by `workspaceId`; client-supplied foreign ids validated against the workspace | `tenancy.int-spec`, `rbac.int-spec`, E2E cross-tenant test |
| Privilege escalation | Role hierarchy (cannot assign equal/higher roles, cannot modify owner); ownership transfer owner-only; billing owner-only | `rbac.int-spec`, shared unit tests |
| Input validation | Zod schemas for every body and query (lengths, formats, enums, UUIDs); 1 MB JSON limit | unit + integration tests |
| Injection | Prisma parameterised queries; raw SQL uses tagged templates (bound parameters) with whitelisted identifiers only | code review |
| XSS | React escaping; no `dangerouslySetInnerHTML`; email templates HTML-escape all dynamic values; CSP and security headers on web and API (helmet) | code review |
| CSV | Upload limited to 2 MB, one `.csv` file, MIME + extension + binary checks, 5,000 rows; exports neutralise spreadsheet formulas (`=`, `+`, `-`, `@`) | `customer-csv.spec`, `crm.int-spec` |
| Tokens | Reset (60 min) and verification (48 h) tokens are single-use, hashed at rest, atomically consumed; previous tokens invalidated on reissue; invitations hashed and bound to the invited email | `auth.int-spec`, `rbac.int-spec` |
| Enumeration | Forgot-password always returns the same response. Registration necessarily reports an already-registered email (rate limited) | `auth.int-spec` |
| Errors and logging | Central filter returns generic messages without stack traces or SQL; pino redacts cookies, authorization, CSRF headers, passwords and tokens | `all-exceptions.filter.spec` |
| Audit | Administrative and data-changing actions written to `audit_logs` with actor and IP | `rbac.int-spec`, billing test |
| Secrets | No secrets in source; `.env` files git-ignored; Compose refuses to start without `POSTGRES_PASSWORD` and `SESSION_SECRET`; seed refuses production and never uses a hard-coded password | review |
| Proxy trust (Vercel) | The web middleware forwards the client IP only together with `PROXY_SECRET`; the API accepts it only on a constant-time secret match and a valid IP, strips the secret header before logging, and discards client-supplied copies at the web edge | `client-ip.spec`, manual check through the proxy |
| Scheduled jobs | `/api/v1/cron/*` returns 404 unless `CRON_SECRET` is set and 401 unless the bearer token matches (constant-time comparison) | manual check |
| Open redirect | Post-login `next` parameter restricted to same-site relative paths | code review |

## Dependency audit

`pnpm audit --prod` initially reported 8 high-severity advisories (nodemailer, multer, postcss, deepmerge-ts). They were fixed by upgrading nodemailer to 10.3.1 and pinning patched versions of multer 2.5.0, postcss 8.5.32 and deepmerge-ts 8.0.2 through pnpm overrides. Remaining: **1 moderate** (`js-yaml` inside `@nestjs/swagger`, used only to render API docs; no untrusted YAML is parsed). CI runs `pnpm audit --prod --audit-level high`.

## Known limitations

- PostgreSQL row-level security is not enabled (see architecture.md); isolation is enforced in the application layer and tested.
- Email verification is soft: unverified users can use the app and see a banner. Accepting an invitation verifies the address.
- Rate limits are per IP. Behind a proxy, set `TRUST_PROXY=true` so the client IP is used; on Vercel also set the same `PROXY_SECRET` in both projects. Without Redis, limits are kept per function instance.
- No multi-factor authentication or SSO yet.

Report vulnerabilities as described in [SECURITY.md](../SECURITY.md).
