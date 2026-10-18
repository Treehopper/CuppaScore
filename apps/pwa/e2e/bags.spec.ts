import { expect, test } from '@playwright/test';

test('add a product and a bag, then open, finish and edit it', async ({ page }) => {
  await page.goto('./#/bags');
  await expect(page.getByText('No bags yet')).toBeVisible();
  await page.getByRole('link', { name: 'Add bag' }).click();

  // no products yet → create one inline and come back
  await page.getByTestId('bag-product').selectOption({ label: 'New product…' });
  await expect(page.getByRole('heading', { name: 'Add product' })).toBeVisible();
  await page.getByLabel('Roaster').fill('Vits der Kaffee');
  await page.getByLabel('Name').fill('Ethiopia Guji Natural');
  await page.getByLabel('Country').fill('Ethiopia');
  await page.getByLabel('Process').selectOption('natural');
  // roast level is 3 steps (F3)
  await expect(page.getByRole('radiogroup', { name: 'Roast level' }).getByRole('radio')).toHaveCount(3);
  await page.getByRole('radio', { name: 'Medium' }).click();
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByLabel(/Tasting notes/).fill('blueberry, dark chocolate, jasmine');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add bag' })).toBeVisible();
  await expect(page.getByTestId('bag-product')).toHaveValue(/.+/);
  await page.getByLabel('Label').fill('Bag #3');
  await page.getByLabel('Roast date').fill('2026-10-02');
  await page.getByLabel('Price (€)').fill('16,90');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Ethiopia Guji Natural · Bag #3' })).toBeVisible();
  await expect(page.getByText('Unopened')).toBeVisible();
  await expect(page.getByText('€16.90')).toBeVisible();
  await page.getByRole('button', { name: 'Open today' }).click();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Open' })).toBeVisible();
  await expect(page.getByTestId('bag-card')).toHaveCount(1);
  await page.getByTestId('bag-card').click();

  await page.getByRole('button', { name: 'Mark finished' }).click();
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();

  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Label').fill('Bag #4');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Ethiopia Guji Natural · Bag #4' })).toBeVisible();

  await page.getByRole('link', { name: 'Vits der Kaffee – Ethiopia Guji Natural' }).click();
  await expect(page.getByRole('heading', { name: 'Ethiopia Guji Natural' })).toBeVisible();
  await expect(page.getByText('blueberry, dark chocolate, jasmine')).toBeVisible();
  await expect(page.getByText(/Natural · Medium · Filter/)).toBeVisible();
});
