import { expect, test } from '@playwright/test';

test.describe('device language detection', () => {
  test.use({ locale: 'de-DE' });
  test('German device gets German UI', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('home')).toHaveText('Logge deine nächste Tasse.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });
});

test('language can be overridden and persists', async ({ page }) => {
  await page.goto('./#/about');
  await page.getByTestId('language-picker').selectOption('it');
  await expect(page.getByRole('radio', { name: 'Sistema' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await page.getByTestId('language-picker').selectOption('en-XA');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^⟦.*⟧$/);
});
