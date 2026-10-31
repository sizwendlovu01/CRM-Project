# Deployment

## Local (verified)

`docker compose up --build` runs the full stack (web, API, PostgreSQL, Redis, Mailpit) using only free, open-source images. See the README for seed and monitoring profiles.

The application was also verified running natively on Windows: Node.js 22 for web and API, PostgreSQL 16 and Redis 7 from Ubuntu packages inside WSL (`scripts/wsl-infra.sh`, no root needed) and Mailpit installed with `winget install axllent.mailpit`.

> The Docker images and Compose file were written and statically checked but could not be built on the development machine because Docker is not installed there. The CI workflow builds both images on every push.

## Production checklist

1. Serve over HTTPS and set `COOKIE_SECURE=true` and `TRUST_PROXY=true`.
2. Use long random values for `SESSION_SECRET` and database passwords.
3. Set `SWAGGER_ENABLED=false` unless the docs should be public.
4. Point `SMTP_*` at a real mail server (any SMTP provider; a free tier is enough for low volume).
5. Run `prisma migrate deploy` before starting new API versions (the API image does this on start).
6. Back up the PostgreSQL volume.

## Deploy to Vercel (free Hobby plan)

The repository deploys as **two Vercel projects** created from the same GitHub repository, plus a free PostgreSQL database. Each app has a `vercel.json` that sets the framework, install and build commands (pinned to pnpm 10.33.0), so the dashboard defaults can stay as they are.

| Vercel project | Root Directory | What runs there |
| --- | --- | --- |
| API (for example `crm-api`) | `apps/api` | The NestJS API as one Vercel Function (`apps/api/api/index.js` wraps the compiled app from `dist/`), migrations during production builds, and a daily reminder cron |
| Web (for example `crm-web`) | `apps/web` | The Next.js app. It proxies `/api/*` to the API, so session cookies stay first-party |

The Hobby plan is free and for non-commercial use. Check each provider's current terms at sign-up, and do not add a payment method that could lead to charges.

### 1. Create the API project

1. In Vercel, choose **Add New > Project** and import `sizwendlovu01/CRM-Project`.
2. Set **Root Directory** to `apps/api`. Leave the framework and commands alone; `apps/api/vercel.json` sets them.
3. Add a database. In the project, open **Storage > Create Database**, pick **Neon** (free plan) and connect it to the project. This adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct). Any other PostgreSQL works too: set `DATABASE_URL`, plus `DIRECT_DATABASE_URL` if the provider gives a separate direct connection string.
4. Add these environment variables (Production, and Preview if you use preview deployments):

| Variable | Value |
| --- | --- |
| `SESSION_SECRET` | 32+ random characters |
| `APP_URL` | The web project's URL, for example `https://crm-web.vercel.app` (used in email links) |
| `CORS_ORIGINS` | Same as `APP_URL` |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `true` |
| `PROXY_SECRET` | 32+ random characters, **the same value as in the web project** |
| `CRON_SECRET` | 16+ random characters (Vercel Cron sends it to `/api/v1/cron/reminders`) |
| `MAIL_TRANSPORT` | `none` to run without email, or leave it unset and set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` and `MAIL_FROM` for any SMTP provider |

Generate random values with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Leave `REDIS_URL` unset on Vercel. With Redis, jobs would be queued for a BullMQ worker, and serverless functions do not keep one running.

5. Deploy. The production build runs `prisma migrate deploy` over the direct connection. Then open `https://<api-project>.vercel.app/health`; it should report `"status":"ok"` and `"database":"up"`.

### 2. Create the web project

1. Choose **Add New > Project** again, import the same repository, and set **Root Directory** to `apps/web`.
2. Add environment variables:

| Variable | Value |
| --- | --- |
| `API_INTERNAL_URL` | The API project's **production** URL, for example `https://crm-api.vercel.app` (no trailing path) |
| `PROXY_SECRET` | The same value as in the API project |

3. Deploy. A build without `API_INTERNAL_URL` stops with an explicit error instead of producing a site that cannot reach the API.
4. If the web URL differs from what you put in the API's `APP_URL` and `CORS_ORIGINS`, update those two variables and redeploy the API.

Open the web URL and create an account. Optional demo data can be loaded from your machine with `DATABASE_URL=<direct url> SEED_PASSWORD=<strong password> pnpm db:seed`. Anyone who knows that password can sign in to the demo accounts, so do not share it publicly.

### How it behaves on Vercel

- **Requests.** `vercel.json` rewrites every API path to the single function. The Nest app is created once per function instance and reused by warm invocations.
- **Client IPs.** The web middleware forwards the visitor's IP with `PROXY_SECRET`. The API trusts that IP only when the secret matches, so rate limits and session records are per visitor rather than per proxy.
- **Email and background jobs.** These run in-process after the response. `waitUntil` keeps the function alive until they finish.
- **Reminders.** The task reminder scan runs from Vercel Cron once a day at 06:00 UTC; Hobby allows daily crons with plus or minus 59 minutes precision. Self-hosted, it runs every 15 minutes.
- **Migrations.** These run only for production builds. Preview builds skip them unless `MIGRATE_ON_PREVIEW=true`, so a preview never changes the production schema.
- **Rate limits** are held in memory per function instance.
- **Preview deployments.** Preview deployments of the web app use the production API set in `API_INTERNAL_URL`.

### What was verified

`vercel build --prod` ran for both projects on Linux with the Vercel CLI, and the bundled API function was booted from an isolated folder and exercised over HTTP. The full E2E suite also passed against the serverless entry point. See [testing-report.md](testing-report.md#vercel-deployment-verification-31-october-2026). The first real deployment has to be made from your Vercel account.

## Other free hosting options

| Need | Option | Notes |
| --- | --- | --- |
| API as a long-running server | Render free web service | Runs `node dist/main.js` with BullMQ, timers and every-15-minute reminders. Spins down after 15 minutes idle |
| PostgreSQL | Neon Free | Permanent free tier; 0.5 GB storage per project |
| Redis | Optional | The API works without Redis |

Sources: [Vercel NestJS](https://vercel.com/docs/frameworks/backend/nestjs), [Vercel monorepos](https://vercel.com/docs/monorepos), [Vercel package managers](https://vercel.com/docs/package-managers), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Neon Vercel integration](https://neon.com/docs/guides/vercel-managed-integration), [Neon plans](https://neon.com/docs/introduction/plans), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby-plan).
