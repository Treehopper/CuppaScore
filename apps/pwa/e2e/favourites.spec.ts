import { expect, test } from '@playwright/test';
import { loadCatalog } from './helpers';

test('favourites without a bag: add from the catalog or by hand, toggle on the product, reused by Add bag', async ({ page }) => {
  await loadCatalog(page);
  await page.goto('./#/products');
  await expect(page.getByTestId('favourites-hint')).toBeVisible();

  // from the catalog
  await page.getByRole('link', { name: 'Add favourite' }).click();
  await expect(page.getByTestId('product-favourite')).toBeChecked();
  await page.getByLabel('Find in catalog').fill('vits ethiopia bonga');
  await page.getByTestId('catalog-result').first().click();
  await expect(page.getByTestId('product-favourite')).toBeChecked();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Äthiopien Bonga Forest' })).toBeVisible();
  await expect(page.getByTestId('favourite-toggle')).toHaveAttribute('aria-pressed', 'true');

  // by hand
  await page.goto('./#/products/new?favourite=1');
  await page.getByLabel('Roaster').fill('Kaffeerösterei am Eck');
  await page.getByLabel('Name').fill('Hausmischung');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Hausmischung' })).toBeVisible();
  await page.getByTestId('favourite-toggle').click();
  await expect(page.getByText('Removed from your favourites')).toBeVisible();
  await expect(page.getByTestId('favourite-toggle')).toHaveAttribute('aria-pressed', 'false');

  await page.goto('./#/products');
  await expect(page.getByTestId('favourites-hint')).toHaveCount(0);
  const favs = page.getByTestId('product-card').filter({ has: page.getByRole('img', { name: 'Favourite' }) });
  await expect(favs).toHaveCount(1);
  await expect(favs).toContainText('Äthiopien Bonga Forest');

  // buying a bag of a favourite later reuses its product
  await page.goto('./#/bags/new');
  await page.getByLabel('Find in catalog').fill('vits ethiopia bonga');
  await page.getByTestId('catalog-result').first().click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: /Äthiopien Bonga Forest · / })).toBeVisible();
  await page.goto('./#/products');
  await expect(page.getByTestId('product-card')).toHaveCount(2);
});
