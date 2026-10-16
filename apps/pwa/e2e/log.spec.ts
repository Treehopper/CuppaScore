import { expect, test } from '@playwright/test';
import { addBag } from './helpers';

test('quick log: stars with undo, swipe, presets remember level', async ({ page }) => {
  await page.goto('./#/log');
  await expect(page.getByText('Add your first bag to start logging.')).toBeVisible();

  await addBag(page);
  await page.getByRole('link', { name: 'Log' }).click();
  await expect(page.getByTestId('log-bag')).toHaveValue(/.+/);
  await expect(page.getByTestId('log-method')).toHaveValue('aeropress');
  await expect(page.getByRole('radio', { name: 'Stars' })).toHaveAttribute('aria-checked', 'true');

  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeDisabled();
  // left edge of a star = half, centre = whole
  await page.locator('[data-star="3"]').click({ position: { x: 4, y: 20 } });
  await expect(page.getByTestId('star-input')).toHaveAttribute('aria-valuenow', '2.5');
  await page.locator('[data-star="4"]').click();
  await expect(page.getByTestId('star-input')).toHaveAttribute('aria-valuenow', '4');
  await page.getByRole('radio', { name: 'Sweet' }).click();
  await save.click();
  await expect(page.getByText('Cup saved')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Removed')).toBeVisible();

  // keyboard: half steps
  await page.getByTestId('star-input').focus();
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('star-input')).toHaveAttribute('aria-valuenow', '4.5');
  await save.click();
  await expect(page.getByText('Cup saved')).toBeVisible();
  await expect(page.getByTestId('preset-chip')).toHaveCount(1);
  await expect(page.getByTestId('preset-chip')).toHaveText(/AeroPress · Ethiopia Guji Natural · Bag #3/);

  // Flair NEO shot with a swipe
  await page.getByTestId('log-method').selectOption('flairNeo');
  await page.getByRole('radio', { name: 'Swipe' }).click();
  await page.getByRole('button', { name: 'More of this' }).click();
  await expect(page.getByText('Cup saved').last()).toBeVisible();
  await expect(page.getByTestId('preset-chip')).toHaveCount(2);

  // level is remembered per preset (B3b)
  await page.getByTestId('preset-chip').filter({ hasText: 'AeroPress' }).click();
  await expect(page.getByRole('radio', { name: 'Stars' })).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('preset-chip').filter({ hasText: 'Flair NEO' }).click();
  await expect(page.getByRole('radio', { name: 'Swipe' })).toHaveAttribute('aria-checked', 'true');

  // the bag now has two cups with stats
  await page.getByRole('link', { name: 'Bags' }).click();
  await expect(page.getByTestId('bag-card')).toContainText('2 cups');
  await page.getByTestId('bag-card').click();
  await expect(page.getByTestId('stats')).toContainText('2 cups: 1 swipes · 1 stars · 0 detailed');
  await expect(page.getByTestId('rating-row')).toHaveCount(2);
});
