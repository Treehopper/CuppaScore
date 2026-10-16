import { expect, test } from '@playwright/test';
import { addBag } from './helpers';

test('manifest is linked and scoped to the base path', async ({ page, baseURL }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await page.request.get(new URL(href!, baseURL).toString());
  const manifest = await res.json();
  const basePath = new URL(baseURL!).pathname;
  expect(manifest.scope).toBe(basePath);
  expect(manifest.id).toBe(basePath);
  expect(manifest.start_url).toBe(`${basePath}?source=homescreen`);
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
});

test('works offline after the service worker is installed', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  // the first load isn't controlled yet; reload so the SW serves the shell
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto('./#/settings');
  await expect(page.getByTestId('about')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('navigation')).toBeVisible();
  await context.setOffline(false);
});

test('manifest icons load and shortcuts open the log in home / café mode', async ({ page, baseURL }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(href!, baseURL);
  const manifest = await (await page.request.get(manifestUrl.toString())).json();
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await page.request.get(new URL(icon.src, manifestUrl).toString());
    expect(res.ok(), icon.src).toBe(true);
  }
  const urls = (manifest.shortcuts as { url: string }[]).map((s) => s.url);
  expect(urls).toEqual([expect.stringContaining('#/log?mode=home'), expect.stringContaining('#/log?mode=cafe')]);
  await page.goto(new URL(urls[1]!, baseURL).toString());
  await expect(page.getByRole('radio', { name: 'Café' })).toHaveAttribute('aria-checked', 'true');
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await page.request.get(new URL(apple!, page.url()).toString())).ok()).toBe(true);
});

test('logging works offline and the data survives a reload', async ({ page, context }) => {
  await addBag(page);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto('./#/log?mode=home');
  await page.getByRole('radio', { name: 'Stars' }).click();
  await page.locator('[data-star="5"]').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Cup saved')).toBeVisible();
  await page.reload();
  await page.goto('./#/ratings');
  await expect(page.getByTestId('rating-row')).toHaveCount(1);
  await context.setOffline(false);
});

test('persistent storage is requested after the first saved cup', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { persistCalls: number };
    w.persistCalls = 0;
    let granted = false;
    navigator.storage.persisted = async () => granted;
    navigator.storage.persist = async () => {
      w.persistCalls++;
      granted = true;
      return true;
    };
  });
  await page.goto('./#/settings');
  await expect(page.getByTestId('persist-status')).toContainText('may clear');
  await addBag(page);
  await page.goto('./#/log?mode=home');
  expect(await page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls)).toBe(0);
  await page.getByRole('radio', { name: 'Stars' }).click();
  await page.locator('[data-star="4"]').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls)).toBe(1);
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByTestId('persist-status')).toContainText('stored persistently');
});
