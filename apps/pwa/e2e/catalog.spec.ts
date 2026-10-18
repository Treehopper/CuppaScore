import { expect, test } from '@playwright/test';
import { addBag, loadCatalog } from './helpers';

const HEADER = 'id,roaster,roaster_city,name,origin_countries,region,process,varieties,roast_level,roast_for,tasting_notes,weight_g,price_eur,url,available,updated_at';

test('Settings → Catalog: load Munich, import a custom CSV with bad rows, own data untouched (F4)', async ({ page }) => {
  await addBag(page, { roaster: 'Vits der Kaffee', name: 'My own Guji' });
  await page.goto('./#/settings');
  const info = page.getByTestId('catalog-info');
  await expect(info).toContainText('No catalog loaded yet');

  await page.getByRole('button', { name: 'Reload Munich catalog' }).click();
  await expect(info).toContainText(/Munich: \d{3} coffees/);
  await expect(page.getByTestId('catalog-report')).toContainText(/\d{3} rows: \d{3} new · 0 updated · 0 unchanged/);

  // reloading the same file changes nothing
  await page.getByRole('button', { name: 'Reload Munich catalog' }).click();
  await expect(page.getByTestId('catalog-report')).toContainText(/: 0 new · 0 updated · \d{3} unchanged/);

  const csv = [
    HEADER,
    'my-roaster-house-blend,My Roaster,München,"House Blend, dark",BR;CO,,natural,,3,espresso,Schokolade;Nuss,1000,,,true,2026-11-01',
    'my-roaster-bad,My Roaster,München,Bad,ET,,wet,,7,filter,,250,12.90,,true,2026-11-01',
    ',,,,,,,,,,,,,,,',
  ].join('\n');
  await page.getByTestId('catalog-file').setInputFiles({ name: 'my-roaster.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const report = page.getByTestId('catalog-report');
  await expect(report).toContainText('1 row: 1 new');
  await expect(report).toContainText('2 rows skipped');
  await expect(report).toContainText('Line 3 · process: not valid');
  await expect(report).toContainText('Line 3 · roast_level: not valid');
  await expect(report).toContainText('Line 4 · id: missing');
  await expect(info).toContainText(/my-roaster\.csv: \d{3} coffees/);

  await page.getByTestId('catalog-file').setInputFiles({ name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2') });
  await expect(page.getByText("This file isn't a catalog CSV")).toBeVisible();

  // own products and bags are untouched
  await page.goto('./#/bags');
  await expect(page.getByTestId('bag-card')).toHaveCount(1);
  await expect(page.getByTestId('bag-card')).toContainText('My own Guji');
});

test('the Munich catalog loads offline once the service worker has precached it', async ({ page, context }) => {
  await page.goto('./#/settings');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Reload Munich catalog' }).click();
  await expect(page.getByTestId('catalog-info')).toContainText(/Munich: \d{3} coffees/);
  await context.setOffline(false);
});

test('choosing no region in the welcome flow loads no catalog', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('radio', { name: /No region/ }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page).toHaveURL(/#\/log$/);
  await page.goto('./#/settings');
  await expect(page.getByLabel('Use the Munich catalog')).not.toBeChecked();
  await expect(page.getByTestId('catalog-info')).toContainText('No catalog loaded yet');
  await expect(page.getByRole('button', { name: 'Reload Munich catalog' })).toBeDisabled();
});

test('Add product: search the catalog (also by localised origin), pick and prefill (F4)', async ({ page }) => {
  await page.goto('./#/products/new');
  await expect(page.getByTestId('catalog-picker')).toHaveCount(0); // no catalog, manual entry only
  await loadCatalog(page);
  await page.goto('./#/products/new');
  const search = page.getByLabel('Find in catalog');
  await search.fill('zzzz');
  await expect(page.getByText('Nothing found')).toBeVisible();
  await search.fill('vits ethiopia bonga');
  await page.getByTestId('catalog-result').first().click();
  await expect(page.getByTestId('catalog-picked')).toContainText('Vits der Kaffee – Äthiopien Bonga Forest');
  await expect(page.getByLabel('Roaster')).toHaveValue('Vits der Kaffee');
  await expect(page.getByLabel('Country')).toHaveValue('Ethiopia');
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Äthiopien Bonga Forest' })).toBeVisible();
});

test('Add bag from the catalog: prefill, product created once and reused; sold-out lots last (F4)', async ({ page }) => {
  await loadCatalog(page);
  await page.goto('./#/bags/new');
  const search = page.getByLabel('Find in catalog');
  await search.fill('vits äthiopien');
  const results = page.getByTestId('catalog-result');
  await expect(results.first()).not.toContainText('Sold out');
  await expect(results.last()).toContainText('Sold out');
  await search.fill('bonga forest');
  await results.first().click();
  await expect(page.getByLabel('Weight (g)')).toHaveValue('250');
  await expect(page.getByLabel('Price (€)')).toHaveValue('9.00');
  await expect(page.getByLabel('Shop')).toHaveValue('Vits der Kaffee');
  await page.getByLabel('Label').fill('Bag #1');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Äthiopien Bonga Forest · Bag #1' })).toBeVisible();

  await page.goto('./#/bags/new');
  await page.getByLabel('Find in catalog').fill('bonga forest');
  await page.getByTestId('catalog-result').first().click();
  await page.getByLabel('Label').fill('Bag #2');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Äthiopien Bonga Forest · Bag #2' })).toBeVisible();
  await page.goto('./#/products');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
});

test.describe('catalog update on start (E3)', () => {
  // the test serves its own "newer" CSV; a service worker would answer from its precache
  test.use({ serviceWorkers: 'block' });

  test('a newer published catalog is imported on start and announced', async ({ page }) => {
    await page.goto('./#/welcome');
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page).toHaveURL(/#\/log$/);
    await loadCatalog(page);

    const original = await (await page.request.get('./catalog/munich.csv')).text();
    const [header, first, ...rest] = original.trimEnd().split('\n');
    const newer = [
      header,
      first!.replace(/,\d{4}-\d{2}-\d{2}\s*$/, ',2027-01-15'),
      ...rest,
      'e2e-roaster-new-lot,E2E Roaster,München,New Lot,KE,,washed,,1,filter,,250,15.00,,true,2027-01-15',
    ].join('\n');
    await page.route('**/catalog/munich.csv', (route) => route.fulfill({ body: newer, contentType: 'text/csv' }));
    await page.reload();
    await expect(page.getByText('Catalog updated: 1 new, 1 changed')).toBeVisible();
    await page.goto('./#/settings');
    await expect(page.getByTestId('catalog-info')).toContainText(/As of Jan 15, 2027/);

    // nothing new → no notice
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByText('Catalog updated')).toHaveCount(0);
  });
});
