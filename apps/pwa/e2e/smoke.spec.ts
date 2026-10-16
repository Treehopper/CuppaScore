import { expect, test } from '@playwright/test';

test('app shell loads under the base path with navigation', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

test('hash routes work on reload', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.getByTestId('about')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('about')).toBeVisible();
  await page.goto('./#/nope');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
