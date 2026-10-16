import { expect, test } from '@playwright/test';

test('app shell loads under the base path', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'CupLog' })).toBeVisible();
  await expect(page.getByTestId('home')).toBeVisible();
});

test('hash routes work on reload', async ({ page }) => {
  await page.goto('./#/about');
  await expect(page.getByTestId('about')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('about')).toBeVisible();
});

test('backend worker starts and answers over IndexedDB', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('api-ready')).toBeAttached();
});
