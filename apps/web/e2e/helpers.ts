import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const PASSWORD = 'E2ePassword123';
export const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';
export const STATE_FILE = resolve(__dirname, '.auth', 'owner.json');
export const OWNER_FILE = resolve(__dirname, '.auth', 'owner-info.json');

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.local`;
}

export interface OwnerInfo {
  email: string;
  slug: string;
  workspaceId: string;
}

export function ownerInfo(): OwnerInfo {
  return JSON.parse(readFileSync(OWNER_FILE, 'utf8')) as OwnerInfo;
}

/** Seed accounts share SEED_PASSWORD (read from env or the local API .env). */
export function seedPassword(): string | undefined {
  if (process.env.SEED_PASSWORD) return process.env.SEED_PASSWORD;
  const file = resolve(__dirname, '..', '..', 'api', '.env');
  if (!existsSync(file)) return undefined;
  return readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('SEED_PASSWORD='))?.slice('SEED_PASSWORD='.length);
}

export async function register(page: Page, opts: { name: string; email: string; workspace: string; password?: string }) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(opts.name);
  await page.getByLabel('Work email').fill(opts.email);
  await page.getByLabel('Password').fill(opts.password ?? PASSWORD);
  await page.getByLabel('Company / workspace name').fill(opts.workspace);
  await page.getByRole('button', { name: 'Create account' }).click();
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+\/dashboard/);
}

/** Reads the newest email sent to an address from Mailpit and extracts the first link with `pathPart`. */
export async function linkFromEmail(request: APIRequestContext, to: string, pathPart: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${to}"` } });
    if (search.ok()) {
      const data = (await search.json()) as { messages?: { ID: string }[] };
      for (const message of data.messages ?? []) {
        const full = await request.get(`${MAILPIT}/api/v1/message/${message.ID}`);
        const text = ((await full.json()) as { Text: string }).Text;
        const match = text.match(new RegExp(`https?://[^\\s]*${pathPart.replace(/[?/]/g, '\\$&')}[^\\s]+`));
        if (match) return new URL(match[0]).pathname + new URL(match[0]).search;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email to ${to} containing ${pathPart}`);
}

/** Performs an authenticated API call from the page context (cookies + CSRF header). */
export async function apiCall<T>(page: Page, method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const csrf = document.cookie.split('; ').find((c) => c.startsWith('crm_csrf='))?.slice(9) ?? '';
      const res = await fetch(`/api/v1${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(csrf) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
    { method, path, body },
  ) as Promise<{ status: number; body: T }>;
}
