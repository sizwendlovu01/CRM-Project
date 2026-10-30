import { expect, test } from '@playwright/test';
import { ownerInfo, STATE_FILE } from './helpers';

test.use({ storageState: STATE_FILE });

test('is usable on a phone: navigation drawer, tables and forms', async ({ page }) => {
  const { slug } = ownerInfo();
  await page.goto(`/w/${slug}/dashboard`);
  await expect(page.getByTestId('kpi-total-customers')).toBeVisible();
  // No horizontal page overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Customers' }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();

  await page.getByRole('button', { name: 'New customer' }).first().click();
  await expect(page.getByLabel('Full name', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto(`/w/${slug}/pipeline`);
  await expect(page.getByTestId('kanban-board')).toBeVisible();
});

test('landing and auth pages render on mobile', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await ctx.close();
});
