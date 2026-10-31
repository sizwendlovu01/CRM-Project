// Applies Prisma migrations during a Vercel build (see vercel.json).
// - Uses the direct (non-pooled) connection when one is provided, because migrations take
//   advisory locks that a transaction-mode pooler such as Neon's PgBouncer cannot hold.
// - Runs only for production builds unless MIGRATE_ON_PREVIEW=true, so preview deployments
//   that share the production database never apply unreleased migrations.
import { spawnSync } from 'node:child_process';

const target = process.env.VERCEL_ENV;
if (target && target !== 'production' && process.env.MIGRATE_ON_PREVIEW !== 'true') {
  console.log(`Skipping prisma migrate deploy for a ${target} build (set MIGRATE_ON_PREVIEW=true to run it).`);
  process.exit(0);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Add it to the Vercel project environment variables.');
  process.exit(1);
}

const result = spawnSync('prisma', ['migrate', 'deploy'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
