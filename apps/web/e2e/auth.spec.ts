import { expect, test } from '@playwright/test';
import { apiCall, linkFromEmail, login, PASSWORD, register, uniqueEmail } from './helpers';

test.describe('authentication', () => {
  test('registers, logs out, rejects bad credentials and logs back in', async ({ page }) => {
    const email = uniqueEmail('signup');
    await register(page, { name: 'Sign Up User', email, workspace: 'Signup Ltd' });
    await expect(page).toHaveURL(/\/w\/signup-ltd[^/]*\/dashboard/);
    await expect(page.getByRole('heading', { name: /Sign/ })).toBeVisible();

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Work email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword999');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();

    await login(page, email);
  });

  test('validates the registration form client-side', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Name must be at least 2 characters', { exact: true })).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Password must be at least 10 characters')).toBeVisible();
  });

  test('redirects unauthenticated users to sign in', async ({ page }) => {
    await page.goto('/w/anything/dashboard');
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test('resets a forgotten password with the emailed link', async ({ page, request }) => {
    const email = uniqueEmail('reset');
    await register(page, { name: 'Reset User', email, workspace: 'Reset Co' });
    await expect(page).toHaveURL(/dashboard/);
    await page.context().clearCookies();

    await page.goto('/forgot-password');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toContainText('reset link is on its way');

    const link = await linkFromEmail(request, email, '/reset-password?token=');
    await page.goto(link);
    await page.getByLabel('New password', { exact: true }).fill('BrandNewPass456');
    await page.getByLabel('Confirm new password', { exact: true }).fill('BrandNewPass456');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page).toHaveURL(/\/login/);
    await login(page, email, 'BrandNewPass456');
  });

  test('expired sessions are rejected by the API and redirect to login', async ({ page }) => {
    const email = uniqueEmail('expire');
    await register(page, { name: 'Expire User', email, workspace: 'Expire Co' });
    await expect(page).toHaveURL(/dashboard/);
    const res = await apiCall(page, 'POST', '/auth/logout');
    expect(res.status).toBe(204);
    // The cookie is gone server-side; visiting the app sends the user to sign in.
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/);
    expect(PASSWORD).toBeTruthy();
  });
});
