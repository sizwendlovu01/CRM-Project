import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiCall, ownerInfo, STATE_FILE } from './helpers';

test.use({ storageState: STATE_FILE });

test.describe('CRM workflows', () => {
  test('creates, edits, searches, archives and deletes a customer', async ({ page }) => {
    const { slug } = ownerInfo();
    const name = `Ada Customer ${Date.now()}`;
    await page.goto(`/w/${slug}/customers`);
    await page.getByRole('button', { name: 'New customer' }).first().click();
    await page.getByLabel('Full name', { exact: true }).fill(name);
    await page.getByLabel('Company', { exact: true }).fill('Analytical Engines');
    await page.getByLabel('Email', { exact: true }).fill(`ada${Date.now()}@example.com`);
    await page.getByLabel('Phone', { exact: true }).fill('+27 11 555 0100');
    await page.getByRole('button', { name: 'Create customer' }).click();
    await expect(page.getByText('Customer created')).toBeVisible();

    await page.getByLabel('Search customers', { exact: true }).fill(name);
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: `Actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await page.getByLabel('Industry', { exact: true }).fill('Computing');
    await page.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Customer updated')).toBeVisible();
    await expect(row.getByText('Active')).toBeVisible();

    await row.getByRole('button', { name: `Actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await expect(page.getByText('Customer archived')).toBeVisible();
    await expect(row).toHaveCount(0);
    await page.getByLabel('Archived filter', { exact: true }).selectOption('true');
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: `Actions for ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete customer' }).click();
    await expect(page.getByText('Customer deleted')).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test('imports and exports customers as CSV', async ({ page }) => {
    const { slug } = ownerInfo();
    const tag = Date.now();
    const file = join(tmpdir(), `import-${tag}.csv`);
    writeFileSync(file, `Full Name,Company,Email,Status\nCsv Person ${tag},Csv Co,csv${tag}@example.com,Active\n,Missing Name,x${tag}@example.com,\n`);

    await page.goto(`/w/${slug}/customers`);
    await page.getByRole('button', { name: 'Import' }).click();
    await page.getByTestId('csv-file-input').setInputFiles(file);
    await page.getByRole('dialog').getByRole('button', { name: 'Import', exact: true }).click();
    const status = page.getByRole('dialog').getByRole('status');
    await expect(status).toContainText('Created');
    await expect(status.locator('dd').first()).toHaveText('1');
    await expect(page.getByText('Row 3:')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    await page.getByLabel('Search customers', { exact: true }).fill(`Csv Person ${tag}`);
    await expect(page.getByRole('row', { name: new RegExp(`Csv Person ${tag}`) })).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const csv = readFileSync(await (await download).path(), 'utf8');
    expect(csv.split('\r\n')[0]).toBe('Full Name,Company,Email,Phone,Address,Industry,Type,Status,Source,Assigned To,Last Interaction,Created At');
    expect(csv).toContain(`Csv Person ${tag}`);
  });

  test('creates a lead and converts it to a customer with a deal', async ({ page }) => {
    const { slug } = ownerInfo();
    const name = `Lead Person ${Date.now()}`;
    await page.goto(`/w/${slug}/leads`);
    await page.getByRole('button', { name: 'New lead' }).first().click();
    await page.getByLabel('Full name', { exact: true }).fill(name);
    await page.getByLabel('Company', { exact: true }).fill('Lead Holdings');
    await page.getByLabel('Estimated value', { exact: true }).fill('42000');
    await page.getByLabel('Status', { exact: true }).selectOption('QUALIFIED');
    await page.getByRole('button', { name: 'Create lead' }).click();
    await expect(page.getByText('Lead created')).toBeVisible();

    await page.getByRole('link', { name }).click();
    await page.getByRole('button', { name: 'Convert' }).click();
    await page.getByRole('button', { name: 'Convert lead' }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await page.getByRole('tab', { name: /Deals/ }).click();
    await expect(page.getByText('Lead Holdings opportunity')).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText('$42,000')).toBeVisible();
  });

  test('drags a deal across pipeline stages and persists it', async ({ page }) => {
    const { slug, workspaceId } = ownerInfo();
    const title = `Drag Deal ${Date.now()}`;
    await page.goto(`/w/${slug}/pipeline`);
    await page.getByRole('button', { name: 'New deal' }).click();
    await page.getByLabel('Deal title', { exact: true }).fill(title);
    await page.getByLabel(/^Value/).fill('15000');
    await page.getByLabel('Stage', { exact: true }).selectOption({ label: 'Lead In' });
    await page.getByRole('button', { name: 'Create deal' }).click();
    await expect(page.getByText('Deal created')).toBeVisible();

    const handle = page.getByRole('button', { name: `Drag ${title}` });
    const target = page.getByTestId('stage-Proposal');
    await handle.scrollIntoViewIfNeeded();
    const from = (await handle.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 25 });
    await page.mouse.up();

    await expect(target.getByText(title)).toBeVisible();
    await expect.poll(async () => {
      const res = await apiCall<{ data: { title: string; stage: { name: string } }[] }>(page, 'GET', `/workspaces/${workspaceId}/deals?q=${encodeURIComponent(title)}`);
      return res.body.data[0]?.stage.name;
    }).toBe('Proposal');

    await page.reload();
    await expect(page.getByTestId('stage-Proposal').getByText(title)).toBeVisible();

    // Keyboard-accessible alternative: move via the card menu to Closed Won.
    await page.getByRole('button', { name: `Move ${title}` }).click();
    await page.getByRole('menuitem', { name: 'Closed Won' }).click();
    await expect(page.getByText(`${title} marked as won`)).toBeVisible();
  });

  test('creates and completes a task and records an activity', async ({ page }) => {
    const { slug } = ownerInfo();
    const title = `Follow up ${Date.now()}`;
    await page.goto(`/w/${slug}/tasks`);
    await page.getByRole('button', { name: 'New task' }).first().click();
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Priority', { exact: true }).selectOption('HIGH');
    await page.getByRole('button', { name: 'Create task' }).click();
    await expect(page.getByText('Task created')).toBeVisible();
    await page.getByLabel('Search tasks', { exact: true }).fill(title);
    await page.getByLabel(`Mark "${title}" as done`).click();
    await expect(page.getByText('Task completed')).toBeVisible();
    await expect(page.getByLabel(`Mark "${title}" as not done`, { exact: true })).toBeChecked();

    await page.getByRole('button', { name: title, exact: true }).click();
    await page.getByLabel('Write a comment', { exact: true }).fill('Done and dusted');
    await page.getByRole('button', { name: 'Comment' }).click();
    await expect(page.getByRole('dialog').getByText('Done and dusted')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.goto(`/w/${slug}/customers`);
    await page.getByRole('button', { name: 'New customer' }).first().click();
    const customer = `Timeline Co ${Date.now()}`;
    await page.getByLabel('Full name', { exact: true }).fill(customer);
    await page.getByRole('button', { name: 'Create customer' }).click();
    await page.getByLabel('Search customers', { exact: true }).fill(customer);
    await page.getByRole('link', { name: new RegExp(customer) }).click();
    await page.getByRole('button', { name: 'Log activity' }).click();
    await page.getByLabel('Type', { exact: true }).selectOption('MEETING');
    await page.getByLabel('Subject', { exact: true }).fill('Kick-off meeting');
    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByText('Activity recorded')).toBeVisible();
    await expect(page.getByLabel('Customer timeline', { exact: true }).getByText('Kick-off meeting')).toBeVisible();
    await page.getByLabel('Add a note', { exact: true }).fill('Prefers email');
    await page.getByRole('button', { name: 'Add note' }).click();
    await expect(page.getByLabel('Customer timeline', { exact: true }).getByText('Prefers email')).toBeVisible();
  });

  test('shows dashboard analytics computed from records', async ({ page }) => {
    const { slug, workspaceId } = ownerInfo();
    const overview = await (async () => {
      await page.goto(`/w/${slug}/dashboard`);
      return apiCall<{ kpis: { totalCustomers: number } }>(page, 'GET', `/workspaces/${workspaceId}/analytics/overview`);
    })();
    await expect(page.getByTestId('kpi-total-customers')).toContainText(String(overview.body.kpis.totalCustomers));
    await expect(page.getByText('Revenue from closed deals')).toBeVisible();
    await page.getByLabel('Date range', { exact: true }).selectOption('365');
    await expect(page.getByTestId('kpi-revenue')).toBeVisible();
    await page.goto(`/w/${slug}/analytics`);
    await expect(page.getByText('Lead conversion').first()).toBeVisible();
    await expect(page.getByText('Sales representative performance')).toBeVisible();
  });
});
