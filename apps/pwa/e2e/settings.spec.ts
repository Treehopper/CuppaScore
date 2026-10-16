import { expect, test } from '@playwright/test';

test('domain settings are stored in the backend and survive reload', async ({ page }) => {
  await page.goto('./#/settings');
  const aero = page.getByRole('checkbox', { name: 'AeroPress' });
  await expect(aero).toBeChecked();
  await aero.uncheck();
  await page.getByRole('radio', { name: 'Swipe' }).click();
  await expect(page.getByRole('radio', { name: 'Swipe' })).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'AeroPress' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Flair NEO' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Swipe' })).toHaveAttribute('aria-checked', 'true');
});
