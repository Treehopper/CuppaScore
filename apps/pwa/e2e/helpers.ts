import { expect, type Page } from '@playwright/test';

/** Creates a product + bag through the UI and leaves the page on the bag detail. */
export async function addBag(
  page: Page,
  o: { roaster?: string; name?: string; label?: string; roastDate?: string; newProduct?: boolean } = {},
): Promise<void> {
  const roaster = o.roaster ?? 'Vits der Kaffee';
  const name = o.name ?? 'Ethiopia Guji Natural';
  const label = o.label ?? 'Bag #3';
  if (o.newProduct !== false) {
    await page.goto('./#/products/new?then=bag');
    await page.getByLabel('Roaster').fill(roaster);
    await page.getByLabel('Name').fill(name);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Add bag' })).toBeVisible();
  } else {
    await page.goto('./#/bags/new');
    await page.getByTestId('bag-product').selectOption({ label: `${roaster} – ${name}` });
  }
  await page.getByLabel('Label').fill(label);
  if (o.roastDate) await page.getByLabel('Roast date').fill(o.roastDate);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: `${name} · ${label}` })).toBeVisible();
}

/** Loads the Munich catalog through Settings → Catalog (F4). */
export async function loadCatalog(page: Page): Promise<void> {
  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Reload Munich catalog' }).click();
  await expect(page.getByTestId('catalog-info')).toContainText(/Munich: \d{3} coffees/);
}
