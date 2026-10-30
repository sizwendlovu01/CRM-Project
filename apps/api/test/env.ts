import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Reads TEST_DATABASE_URL from the environment, falling back to apps/api/.env for local runs. */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const file = resolve(__dirname, '..', '.env');
  if (existsSync(file)) {
    const line = readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('TEST_DATABASE_URL='));
    if (line) return line.slice('TEST_DATABASE_URL='.length).trim();
  }
  throw new Error('TEST_DATABASE_URL is not configured');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
process.env.SESSION_SECRET = 'integration-test-secret-that-is-long-enough-1234567890';
process.env.MAIL_TRANSPORT = 'memory';
process.env.JOBS_INLINE = 'true';
process.env.LOG_LEVEL = 'silent';
process.env.APP_URL = 'http://localhost:3000';
process.env.RATE_LIMIT_PER_MINUTE = '100000';
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '100000';
delete process.env.REDIS_URL;
