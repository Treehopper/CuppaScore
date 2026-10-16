import { expect, test } from '@playwright/test';

// Phone-width layout guard: no page may scroll horizontally.
for (const path of ['#/log', '#/bags', '#/bags/new', '#/products', '#/products/new', '#/settings']) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`./${path}`);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
