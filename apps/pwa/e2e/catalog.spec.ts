import { expect, test } from '@playwright/test';
import { addBag } from './helpers';

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
