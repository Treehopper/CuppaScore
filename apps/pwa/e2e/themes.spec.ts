import { expect, test, type Page } from '@playwright/test';

const bg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('System theme follows the colour scheme (Crema / Espresso)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'crema');
  expect(await bg(page)).toBe('rgb(247, 239, 228)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'espresso');
  expect(await bg(page)).toBe('rgb(30, 20, 16)');
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', '#1e1410');
});

test('chosen theme persists across reloads without a flash', async ({ page }) => {
  await page.goto('./#/about');
  await page.getByRole('radio', { name: 'Solarized Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'solarized-dark');
  await page.reload();
  // set by the pre-paint script before the app boots
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('solarized-dark');
  await expect(page.getByRole('radio', { name: 'Solarized Dark' })).toHaveAttribute('aria-checked', 'true');
});
