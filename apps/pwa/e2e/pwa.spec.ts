import { expect, test } from '@playwright/test';

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
  await page.goto('./#/about');
  await expect(page.getByTestId('about')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'CupLog' })).toBeVisible();
  await context.setOffline(false);
});
