import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addBag } from './helpers';

async function logStars(page: Page, bag: string, stars: number, meal: string): Promise<void> {
  await page.goto('./#/log?mode=home');
  await page.getByTestId('log-bag').selectOption({ label: bag });
  await page.getByRole('radio', { name: 'Stars' }).click();
  await page.locator(`[data-star="${stars}"]`).click();
  await page.getByRole('radio', { name: meal }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Cup saved')).toBeVisible();
}

test('stats: empty state, context effects, freshness, beans, distribution, venues; bag trend', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('./#/stats');
  await expect(page.getByText('Log a few cups and your insights appear here.')).toBeVisible();

  await addBag(page, { roaster: 'Vits', name: 'Guji', label: 'Bag #3', roastDate: '2026-10-01' });
  await addBag(page, { roaster: 'MvM', name: 'Supremo', label: 'Bag #1', roastDate: '2026-09-01' });
  for (let i = 0; i < 5; i++) {
    await logStars(page, 'Guji · Bag #3', 5, 'Sweet');
    await logStars(page, 'Supremo · Bag #1', 2, 'Savory');
  }
  await page.goto('./#/log?mode=cafe');
  await page.getByLabel('Name of the café').fill('Vits');
  await page.getByTestId('log-drink').selectOption('cappuccino');
  await page.getByRole('radio', { name: 'Stars' }).click();
  await page.locator('[data-star="4"]').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Cup saved')).toBeVisible();

  await page.getByRole('link', { name: 'Stats' }).click();
  const ins = page.getByTestId('insights');
  await expect(ins).toContainText('11');
  await expect(page.getByRole('heading', { name: 'What moves your score' })).toBeVisible();
  const sweet = page.getByRole('button', { name: /^Sweet: \+\d+ · 5 cups$/ });
  await expect(sweet).toBeVisible();
  await expect(page.getByRole('button', { name: /^Savory: −?-?\d+ · 5 cups$/ })).toBeVisible();

  // freshness curve: a keyboard-operable crosshair
  const fresh = page.getByTestId('freshness');
  await expect(fresh).toContainText('tastes best around');
  const slider = fresh.getByRole('slider', { name: 'Freshness' });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', /days? after roast/);

  // beans ranked: Guji first
  await expect(page.getByTestId('bean-row').first()).toContainText('Guji');
  await expect(page.getByTestId('bean-row')).toHaveCount(2);

  // distribution has a table view
  const dist = page.getByRole('region', { name: 'How you rate' });
  await dist.getByText('Show as table').click();
  await expect(dist.getByRole('row', { name: '5 5' })).toBeVisible();

  await expect(page.getByTestId('venue-ranking')).toContainText('Cappuccino');
  await expect(page.getByTestId('venue-ranking')).toContainText('Vits');

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }

  // bag detail: trend chart + best pairing
  await page.goto('./#/bags');
  await page.getByTestId('bag-card').filter({ hasText: 'Guji' }).click();
  await expect(page.getByRole('slider', { name: 'Trend' })).toBeVisible();
  await expect(page.getByTestId('best')).toContainText('Best food pairing: Sweet');
});
