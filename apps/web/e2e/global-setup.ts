import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { apiCall, OWNER_FILE, register, STATE_FILE, uniqueEmail } from './helpers';

/** Registers one owner (Growth plan via simulated billing) whose session most specs reuse. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000';
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  const email = uniqueEmail('owner');
  await register(page, { name: 'E2E Owner', email, workspace: `E2E Corp ${Date.now().toString(36)}` });
  await page.waitForURL(/\/w\/[^/]+\/dashboard/, { timeout: 30_000 });
  const slug = page.url().split('/w/')[1]!.split('/')[0]!;
  const me = await apiCall<{ memberships: { workspace: { id: string; slug: string } }[] }>(page, 'GET', '/auth/me');
  const workspaceId = me.body.memberships.find((m) => m.workspace.slug === slug)!.workspace.id;
  const upgrade = await apiCall(page, 'POST', `/workspaces/${workspaceId}/subscription/change-plan`, { plan: 'GROWTH' });
  if (upgrade.status !== 200) throw new Error(`Plan upgrade failed: ${upgrade.status}`);
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  await page.context().storageState({ path: STATE_FILE });
  writeFileSync(OWNER_FILE, JSON.stringify({ email, slug, workspaceId }));
  await browser.close();
}
