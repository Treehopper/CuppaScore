import { expect, test } from '@playwright/test';

test('café mode: new venue, details, presets, same as last time and venue list', async ({ page }) => {
  await page.goto('./#/log');
  await page.getByRole('radio', { name: 'Café' }).click();

  // first visit: a new café, cappuccino with details
  await expect(page.getByTestId('log-venue')).toHaveValue('__new__');
  const save = page.getByRole('button', { name: 'Save' });
  await page.locator('[data-star="4"]').click();
  await expect(save).toBeDisabled();
  await page.getByLabel('Name of the café').fill('Vits');
  await page.getByTestId('log-drink').selectOption('cappuccino');
  await page.getByText('Milk, size, bean & price').click();
  await page.getByLabel('Milk').selectOption('dairy');
  await page.getByLabel('Bean').selectOption('house');
  await page.getByLabel('Price (€)').fill('3,9');
  await save.click();
  await expect(page.getByText('Cup saved')).toBeVisible();
  await expect(page.getByTestId('log-venue')).toHaveValue(/^(?!__new__).+/);
  await expect(page.getByTestId('preset-chip')).toHaveText(['Vits · Cappuccino · Dairy']);
  await expect(page.getByTestId('preset-chip')).toHaveAttribute('aria-pressed', 'true');
  // details come back from the preset
  await expect(page.getByLabel('Price (€)')).toHaveValue('3.9');

  // an espresso with a swipe
  await page.getByTestId('log-drink').selectOption('espresso');
  await page.getByRole('radio', { name: 'Swipe' }).click();
  await page.getByRole('button', { name: 'More of this' }).click();
  await expect(page.getByTestId('preset-chip')).toHaveCount(2);
  // only the latest cup's toast (and Undo) stays
  await expect(page.getByText('Cup saved')).toHaveCount(1);

  // "same as last time here" restores the espresso and its level
  await page.getByTestId('log-drink').selectOption('latte');
  await page.getByRole('button', { name: 'Same as last time here' }).click();
  await expect(page.getByTestId('log-drink')).toHaveValue('espresso');
  await expect(page.getByRole('radio', { name: 'Swipe' })).toHaveAttribute('aria-checked', 'true');

  // the mode is remembered
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Café' })).toHaveAttribute('aria-checked', 'true');

  // venue list
  await page.getByRole('link', { name: 'All cafés' }).click();
  await expect(page.getByTestId('venue-card')).toHaveCount(1);
  await expect(page.getByTestId('venue-card')).toContainText('Vits');
  await expect(page.getByTestId('venue-card')).toContainText('2 visits');
  await page.getByRole('link', { name: 'Same as last time here' }).click();
  await expect(page.getByTestId('log-drink')).toHaveValue('espresso');
  await expect(page.getByTestId('log-venue')).not.toHaveValue('__new__');
});
