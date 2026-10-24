import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('welcome flow: theme preview, region catalog, favourites, gear & level, reminders; shown only once', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL(/#\/welcome$/);
  await expect(page.getByRole('heading', { name: 'Welcome to CupLog' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByText('Step 1 of 6')).toBeVisible();

  await page.getByRole('radio', { name: 'Solarized Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'solarized-dark');
  await page.getByRole('button', { name: 'Next' }).click();

  // install card (Android Chrome without a deferred prompt → menu hint)
  await expect(page.getByRole('heading', { name: 'Put CupLog on your home screen' })).toBeVisible();
  await expect(page.getByText('Use your browser\'s menu')).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();

  // region: Munich is preselected and loads the catalog in the background (F4)
  await expect(page.getByRole('heading', { name: 'Where do you buy coffee?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Munich/ })).toBeChecked();
  await page.getByRole('button', { name: 'Next' }).click();

  // favourites from the catalog, without a bag (they shape recommendations)
  await expect(page.getByRole('heading', { name: 'Coffees you already love?' })).toBeVisible();
  const search = page.getByLabel('Find in catalog');
  for (const q of ['vits ethiopia bonga', 'dallmayr']) {
    await search.fill(q);
    await page.getByTestId('catalog-result').first().click();
  }
  const favs = page.getByTestId('welcome-favourites');
  await expect(favs.getByRole('listitem')).toHaveCount(2);
  await expect(favs).toContainText('Vits der Kaffee – Äthiopien Bonga Forest');
  await favs.getByRole('button', { name: /^Remove / }).last().click();
  await expect(favs.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'Your gear & rating style' })).toBeVisible();
  await page.getByLabel('V60').uncheck();
  await page.getByRole('radio', { name: 'Swipe' }).click();
  await expect(page.getByText('Swipe: fastest')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'Reminders?' })).toBeVisible();
  await expect(page.getByLabel('On weekdays, if you haven\'t logged anything yet')).toBeChecked();
  await expect(page.getByLabel('On weekends, if nothing is logged')).not.toBeChecked();
  await page.getByLabel('From').first().fill('09:30');
  await page.getByLabel('When an open bag expires within 2 days').check();
  const [ics] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Also add a daily reminder to my calendar' }).click(),
  ]);
  expect(await readFile(await ics.path(), 'utf8')).toContain('T093000');
  await page.getByRole('button', { name: 'Enable reminders' }).click();

  await expect(page).toHaveURL(/#\/log$/);
  await expect(page.getByRole('navigation')).toBeVisible();

  await page.goto('./#/products');
  await expect(page.getByTestId('product-card')).toHaveCount(2);
  await expect(page.getByTestId('product-card').filter({ has: page.getByRole('img', { name: 'Favourite' }) })).toHaveCount(1);
  await expect(page.getByTestId('favourites-hint')).toHaveCount(0);

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('radio', { name: 'Swipe' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('catalog-info')).toContainText(/Munich: \d{3} coffees/);
  await expect(page.getByLabel('V60')).not.toBeChecked();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export all (JSON)' }).click()]);
  const bundle = JSON.parse(await readFile(await dl.path(), 'utf8'));
  expect(bundle.settings.onboardingCompletedAt).toBeTruthy();
  expect(bundle.settings.reminders.enabled).toBe(true);
  const rules = bundle.settings.reminders.rules as { id: string; enabled: boolean; time?: string }[];
  expect(rules.find((r) => r.id === 'rem_1')).toMatchObject({ enabled: true, time: '09:30' });
  expect(rules.find((r) => r.id === 'rem_6')).toMatchObject({ enabled: true });
  expect(rules.find((r) => r.id === 'rem_2')).toMatchObject({ enabled: false });

  await page.goto('./');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page).not.toHaveURL(/welcome/);
});

test('skip finishes the flow; deep links never show it', async ({ page }) => {
  await page.goto('./#/bags');
  await expect(page.getByRole('heading', { level: 1, name: 'Bags' })).toBeVisible();
  await page.goto('./');
  await expect(page).toHaveURL(/#\/welcome$/);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page).toHaveURL(/#\/log$/);
  await page.goto('./');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page).not.toHaveURL(/welcome/);
});

test.describe('on iPhone', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  test('shows the Add to Home Screen steps', async ({ page }) => {
    await page.goto('./#/welcome');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Tap Share in Safari')).toBeVisible();
    await expect(page.getByText('Add to Home Screen')).toBeVisible();
  });
});
