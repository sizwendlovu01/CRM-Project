import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { testDatabaseUrl } from './env';

/**
 * Creates the test database if needed, applies migrations and truncates all tables so every
 * integration run starts from a clean, fully migrated schema.
 */
export default async function globalSetup(): Promise<void> {
  const url = new URL(testDatabaseUrl());
  const dbName = url.pathname.replace(/^\//, '');
  if (!/^[a-z0-9_]+$/i.test(dbName)) throw new Error(`Unsafe test database name: ${dbName}`);
  if (!/test/i.test(dbName)) throw new Error(`Refusing to run integration tests against non-test database "${dbName}"`);

  const admin = new URL(url.toString());
  admin.pathname = '/postgres';
  const adminClient = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  const exists = await adminClient.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
  if (exists.length === 0) await adminClient.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await adminClient.$disconnect();

  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  });

  const client = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const tables = await client.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length) {
    await client.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  }
  await client.$disconnect();
}
