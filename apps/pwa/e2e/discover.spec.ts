import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loadCatalog } from './helpers';

test('Discover: no catalog → link to Settings', async ({ page }) => {
  await page.goto('./#/discover');
  await expect(page.getByTestId('discover-empty')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Load a catalog in Settings' })).toHaveAttribute('href', '#/settings');
});

test('Discover: suggestions from a favourite, why-text, wishlist, dismiss + undo, filters, bought it (D1–D8)', async ({ page }) => {
  await loadCatalog(page);
  await page.goto('./#/products/new?favourite=1');
  await page.getByLabel('Find in catalog').fill('vits ethiopia bonga');
  await page.getByTestId('catalog-result').first().click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Äthiopien Bonga Forest' })).toBeVisible();

  await page.getByRole('link', { name: 'Discover' }).click();
  await expect(page.getByTestId('cold-start')).toContainText('1 of 5');
  const cards = page.getByTestId('reco-card');
  await expect(cards).toHaveCount(20);
  await expect(page.getByTestId('reco-why').first()).toContainText('Like Vits der Kaffee – Äthiopien Bonga Forest');
  await expect(cards.filter({ hasText: 'Äthiopien Bonga Forest · Vits' })).toHaveCount(0); // favourites aren't suggested
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);

  // wishlist
  const first = cards.first();
  const name = (await first.locator('h3 .name').textContent())!;
  await first.getByRole('button', { name: 'Wishlist' }).click();
  await expect(first.getByRole('button', { name: 'On wishlist' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('tab', { name: 'Wishlist (1)' })).toBeVisible();

  // dismiss + undo brings it back, still wishlisted
  await first.getByRole('button', { name: 'Not for me' }).click();
  await expect(cards.filter({ hasText: name })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Wishlist (0)' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(cards.filter({ hasText: name }).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Wishlist (1)' })).toBeVisible();

  await page.getByRole('tab', { name: 'Wishlist (1)' }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(name);
  await page.getByRole('tab', { name: 'For you' }).click();

  // filters
  await page.getByText('Filters').click();
  await page.getByRole('radio', { name: 'Espresso' }).click();
  await expect(cards.first()).toBeVisible();
  for (const c of await cards.all()) await expect(c).toContainText(/Espresso|Omni/i);
  await page.getByLabel('Price').selectOption({ label: 'up to €40/kg' });
  await expect(cards.or(page.getByText('Nothing matches these filters.')).first()).toBeVisible();
  await page.getByLabel('Price').selectOption({ label: 'Any' });
  await page.getByRole('radio', { name: 'Any' }).click();

  // "Bought it" opens Add bag prefilled from the catalog
  await cards.first().getByRole('link', { name: 'Bought it' }).click();
  await expect(page.getByTestId('catalog-picked')).toContainText(name);
});
