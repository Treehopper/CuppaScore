import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { addBag } from './helpers';

async function logStars(page: Page, stars: number): Promise<void> {
  await page.getByRole('link', { name: 'Log' }).click();
  await page.getByRole('radio', { name: 'Stars' }).click();
  await page.locator(`[data-star="${stars}"]`).click();
  await page.getByRole('radiogroup', { name: 'Would buy again?' }).getByRole('radio', { name: 'Yes' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Cup saved')).toBeVisible();
}

test('history: edit a cup, flag it as not representative, delete and undo', async ({ page }) => {
  await addBag(page);
  await logStars(page, 4);

  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByTestId('rating-row')).toHaveCount(1);
  await expect(page.getByTestId('rating-row')).toContainText('AeroPress · Ethiopia Guji Natural · Bag #3');
  await page.getByTestId('rating-row').click();

  await expect(page.getByRole('heading', { name: 'Edit cup' })).toBeVisible();
  await expect(page.getByTestId('star-input')).toHaveAttribute('aria-valuenow', '4');
  await page.locator('[data-star="3"]').click();
  // tapping the chosen answer again clears it
  await page.getByRole('radiogroup', { name: 'Would buy again?' }).getByRole('radio', { name: 'Yes' }).click();
  await page.getByRole('radio', { name: 'Sweet' }).click();
  await page.getByLabel('Meal note').fill('Croissant');
  await page.getByLabel('When').fill('2026-10-15T19:30');
  await page.getByLabel('Not representative').check();
  await page.getByLabel('Reason').fill('grinder clogged');
  await page.getByRole('button', { name: 'Save' }).click();

  const row = page.getByTestId('rating-row');
  await expect(row).toContainText('★ 3');
  await expect(row).toContainText('Sweet');
  await expect(row).toContainText('19:30');
  await expect(row.locator('.badge')).toBeVisible();

  await row.click();
  await expect(page.getByLabel('Meal note')).toHaveValue('Croissant');
  await expect(page.getByLabel('Not representative')).toBeChecked();
  await expect(page.getByLabel('Reason')).toHaveValue('grinder clogged');
  await expect(page.getByLabel('Time of day')).toContainText('Auto (Evening)');
  await expect(
    page.getByRole('radiogroup', { name: 'Would buy again?' }).getByRole('radio', { checked: true }),
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Cup deleted')).toBeVisible();
  await expect(page.getByTestId('rating-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('rating-row')).toHaveCount(1);
});

test('backup: export JSON and CSV, replace-import restores deleted data', async ({ page }) => {
  await addBag(page);
  await logStars(page, 5);

  await page.getByRole('link', { name: 'Settings' }).click();
  const [json] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export all (JSON)' }).click(),
  ]);
  expect(json.suggestedFilename()).toMatch(/^cuplog-\d{4}-\d{2}-\d{2}\.json$/);
  const jsonPath = await json.path();
  const bundle = JSON.parse(await readFile(jsonPath, 'utf8'));
  expect(bundle.ratings).toHaveLength(1);

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Ratings as CSV' }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  expect((await readFile(await csv.path(), 'utf8')).split('\n').filter(Boolean)).toHaveLength(2);

  // delete the cup, then bring it back with a replace import
  await page.goto('./#/ratings');
  await page.getByTestId('rating-row').click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('rating-row')).toHaveCount(0);

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Replace' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('import-file').setInputFiles(jsonPath);
  await expect(page.getByTestId('import-report')).toContainText('Cups: 1 added');

  await page.goto('./#/ratings');
  await expect(page.getByTestId('rating-row')).toHaveCount(1);

  // not a backup
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('import-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('nope') });
  await expect(page.getByText('This file is not a CupLog backup.')).toBeVisible();
});
