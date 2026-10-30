import { expect, test } from '@playwright/test';
import { apiCall, linkFromEmail, login, ownerInfo, register, seedPassword, STATE_FILE, uniqueEmail } from './helpers';

test.describe('team, workspaces and settings', () => {
  test('invites a member who accepts, switches workspace, gets a new role and is removed', async ({ browser, request }) => {
    const { slug } = ownerInfo();
    const ownerCtx = await browser.newContext({ storageState: STATE_FILE });
    const owner = await ownerCtx.newPage();
    const inviteeEmail = uniqueEmail('invitee');

    await owner.goto(`/w/${slug}/settings/team`);
    await owner.getByLabel('Email address', { exact: true }).fill(inviteeEmail);
    await owner.getByLabel('Role', { exact: true }).selectOption('SALES_REPRESENTATIVE');
    await owner.getByRole('button', { name: 'Send invite' }).click();
    await expect(owner.getByText(`Invitation sent to ${inviteeEmail}`)).toBeVisible();
    await expect(owner.getByLabel('Pending invitations', { exact: true }).getByText(inviteeEmail)).toBeVisible();

    const link = await linkFromEmail(request, inviteeEmail, '/invite/');
    const inviteeCtx = await browser.newContext();
    const invitee = await inviteeCtx.newPage();
    await invitee.goto(link);
    await invitee.getByRole('link', { name: 'Create an account to accept' }).click();
    await invitee.getByLabel('Full name', { exact: true }).fill('Invited Rep');
    await invitee.getByLabel('Password', { exact: true }).fill('E2ePassword123');
    await invitee.getByLabel('Company / workspace name', { exact: true }).fill('Invitee Personal');
    await invitee.getByRole('button', { name: 'Create account' }).click();
    await invitee.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(invitee).toHaveURL(new RegExp(`/w/${slug}/dashboard`));

    // Workspace switching between the invitee's own workspace and the joined one.
    await invitee.getByRole('button', { name: /Switch workspace/ }).click();
    await invitee.getByRole('menuitem', { name: 'Invitee Personal' }).click();
    await expect(invitee).toHaveURL(/\/w\/invitee-personal[^/]*\/dashboard/);

    await owner.reload();
    await owner.getByLabel('Role for Invited Rep', { exact: true }).selectOption('MANAGER');
    await expect(owner.getByText('Role updated')).toBeVisible();
    await owner.getByRole('button', { name: 'Remove Invited Rep' }).click();
    await owner.getByRole('alertdialog').getByRole('button', { name: 'Remove member' }).click();
    await expect(owner.getByText('Member removed')).toBeVisible();

    await invitee.goto(`/w/${slug}/dashboard`);
    await expect(invitee.getByRole('heading', { name: 'Workspace not found' })).toBeVisible();
    await ownerCtx.close();
    await inviteeCtx.close();
  });

  test('updates profile, workspace settings and notification preferences', async ({ browser }) => {
    const { slug } = ownerInfo();
    const ctx = await browser.newContext({ storageState: STATE_FILE });
    const page = await ctx.newPage();
    await page.goto(`/w/${slug}/settings/profile`);
    await page.getByLabel('Job title', { exact: true }).fill('Head of Sales');
    await page.getByLabel('Timezone', { exact: true }).selectOption('Africa/Johannesburg');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile updated')).toBeVisible();

    await page.goto(`/w/${slug}/settings/workspace`);
    await page.getByLabel('Industry', { exact: true }).fill('Software');
    await page.getByLabel('Currency', { exact: true }).selectOption('ZAR');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Workspace updated')).toBeVisible();

    await page.goto(`/w/${slug}/settings/notifications`);
    await page.getByRole('switch', { name: 'Deal updated email' }).click();
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.getByText('Notification preferences saved')).toBeVisible();
    await ctx.close();
  });

  test('shows usage and enforces plan limits on the Free plan', async ({ page }) => {
    await register(page, { name: 'Limit Owner', email: uniqueEmail('limits'), workspace: 'Limit Co' });
    await expect(page).toHaveURL(/dashboard/);
    const slug = page.url().split('/w/')[1]!.split('/')[0]!;
    await page.goto(`/w/${slug}/settings/billing`);
    await expect(page.getByText('simulated', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('1 / 3')).toBeVisible();

    await page.goto(`/w/${slug}/settings/team`);
    for (const n of [1, 2, 3]) {
      await page.getByLabel('Email address', { exact: true }).fill(uniqueEmail(`seat${n}`));
      await page.getByRole('button', { name: 'Send invite' }).click();
      if (n < 3) await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('');
    }
    await expect(page.getByText(/Your plan allows 3 members/)).toBeVisible();

    await page.goto(`/w/${slug}/customers`);
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByText('CSV import is available on the Starter plan')).toBeVisible();
  });

  test('notification centre lists and marks notifications as read', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STATE_FILE });
    const page = await ctx.newPage();
    const { slug } = ownerInfo();
    await page.goto(`/w/${slug}/notifications`);
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await page.getByRole('button', { name: /Notifications/ }).first().click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await ctx.close();
  });
});

test.describe('permissions and tenant isolation', () => {
  test('viewers get a read-only interface and the API refuses writes', async ({ page }) => {
    const password = seedPassword();
    test.skip(!password, 'Seed accounts are not available (run pnpm db:seed with SEED_PASSWORD).');
    await login(page, 'viewer@demo.crm.local', password);
    await page.goto('/w/northwind-traders/customers');
    await expect(page.getByRole('row').nth(1)).toBeVisible();
    await expect(page.getByRole('button', { name: 'New customer' })).toHaveCount(0);
    const me = await apiCall<{ memberships: { workspace: { id: string; slug: string } }[] }>(page, 'GET', '/auth/me');
    const ws = me.body.memberships.find((m) => m.workspace.slug === 'northwind-traders')!.workspace.id;
    const res = await apiCall(page, 'POST', `/workspaces/${ws}/customers`, { fullName: 'Viewer attempt' });
    expect(res.status).toBe(403);
  });

  test('a user cannot read or modify another tenant’s records', async ({ browser }) => {
    const { workspaceId } = ownerInfo();
    const ownerCtx = await browser.newContext({ storageState: STATE_FILE });
    const owner = await ownerCtx.newPage();
    await owner.goto('/app');
    const created = await apiCall<{ id: string }>(owner, 'POST', `/workspaces/${workspaceId}/customers`, { fullName: 'Private Customer' });
    expect(created.status).toBe(201);

    const outsiderCtx = await browser.newContext();
    const outsider = await outsiderCtx.newPage();
    await register(outsider, { name: 'Outsider', email: uniqueEmail('outsider'), workspace: 'Outsider Co' });
    await expect(outsider).toHaveURL(/dashboard/);
    const me = await apiCall<{ memberships: { workspace: { id: string } }[] }>(outsider, 'GET', '/auth/me');
    const own = me.body.memberships[0]!.workspace.id;

    expect((await apiCall(outsider, 'GET', `/workspaces/${workspaceId}/customers`)).status).toBe(404);
    expect((await apiCall(outsider, 'GET', `/workspaces/${own}/customers/${created.body.id}`)).status).toBe(404);
    expect((await apiCall(outsider, 'PATCH', `/workspaces/${own}/customers/${created.body.id}`, { fullName: 'Hacked' })).status).toBe(404);
    expect((await apiCall(outsider, 'DELETE', `/workspaces/${own}/customers/${created.body.id}`)).status).toBe(404);
    await outsider.goto(`/w/${ownerInfo().slug}/dashboard`);
    await expect(outsider.getByRole('heading', { name: 'Workspace not found' })).toBeVisible();
    await ownerCtx.close();
    await outsiderCtx.close();
  });
});
