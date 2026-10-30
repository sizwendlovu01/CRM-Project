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

## Free public hosting (R0) - evaluation

No public deployment was made: it requires creating third-party accounts, which only you can do. Findings (checked October 2026; limits change, so re-check at sign-up):

| Need | Option | Free-tier facts | Fit |
| --- | --- | --- | --- |
| Web (Next.js) | Vercel Hobby | Free, no billing cycle, but restricted to non-commercial personal use; usage caps lock features for 30 days when exceeded | Good for a portfolio demo |
| API (NestJS) | Render free web service | Spins down after 15 minutes idle (about 1 minute cold start); 750 free instance hours per month per workspace | Works for demos |
| PostgreSQL | Neon Free | Permanent free tier, no credit card; 0.5 GB storage and 100 CU-hours per project per month; scales to zero | Best free Postgres option |
| PostgreSQL | Render free Postgres | 1 GB, but expires 30 days after creation | Not suitable long term |
| Redis | Optional | The API runs without Redis (in-process jobs, memory rate limits) | Skip Redis on free hosting |
| Cloudflare Pages / Workers | Not used | Cannot run the NestJS + Prisma server as written | Not suitable |
| GitHub Pages | Docs only | Static hosting | Could host documentation |

Suggested R0 demo layout: web on Vercel Hobby (`API_INTERNAL_URL` = the Render API URL), API on Render free (`DATABASE_URL` from Neon, no `REDIS_URL`, SMTP optional), database on Neon Free. Expect cold starts and do not use it for commercial traffic. Check each provider's current terms for any payment-method requirement before signing up; do not add a card if it can lead to charges.

Sources: [Render free tier article](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026), [Neon plans](https://neon.com/docs/introduction/plans), [Neon free tier FAQ](https://neon.com/faqs/managed-postgres-databases-free-tier), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby-plan), [Vercel limits](https://vercel.com/docs/limits).
