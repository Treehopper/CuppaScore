import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addBag } from './helpers';

const THEMES = ['crema', 'espresso', 'solarized-light', 'solarized-dark'] as const;
const ROUTES = [
  '#/log',
  '#/log?mode=cafe',
  '#/ratings',
  '#/bags',
  '#/bags/new',
  '#/products',
  '#/products/new',
  '#/venues',
  '#/settings',
];

async function seed(page: Page): Promise<void> {
  await addBag(page, { roastDate: '2026-10-01' });
  await page.goto('./#/log?mode=home');
  await page.getByRole('radio', { name: 'Detail' }).click();
  await page.locator('[data-star="4"]').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.goto('./#/log?mode=cafe');
  await page.getByLabel('Name of the café').fill('Vits');
  await page.getByRole('radio', { name: 'Stars' }).click();
  await page.locator('[data-star="3"]').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Cup saved')).toBeVisible();
}

async function scan(page: Page, where: string): Promise<void> {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(summary, `axe violations on ${where}`).toEqual([]);
}

for (const theme of THEMES) {
  test(`axe: no WCAG A/AA violations in ${theme}`, async ({ page }) => {
    test.setTimeout(60_000); // ~13 axe scans
    await page.addInitScript((th) => {
      localStorage.setItem('cuplog:prefs', JSON.stringify({ theme: th }));
    }, theme);
    await seed(page);
    for (const route of ROUTES) {
      await page.goto(`./${route}`);
      await scan(page, `${route} (${theme})`);
    }
    // detail screens and expanded forms
    await page.goto('./#/bags');
    await page.getByTestId('bag-card').first().click();
    await scan(page, `bag detail (${theme})`);
    await page.goto('./#/ratings');
    await page.getByTestId('rating-row').first().click();
    await scan(page, `rating edit (${theme})`);
    await page.goto('./#/log?mode=home');
    await page.getByRole('radio', { name: 'Detail' }).click();
    await page.getByText('Brew details').click();
    await scan(page, `quick log detail (${theme})`);
    await page.getByRole('radio', { name: 'Swipe' }).click();
    await scan(page, `quick log swipe (${theme})`);
  });
}
