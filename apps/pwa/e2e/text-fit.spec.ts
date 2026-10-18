import { expect, test, type Page } from '@playwright/test';
import { addBag, loadCatalog } from './helpers';

// Owner feedback F1: long German / pseudo-locale labels must never overlap or be clipped at 360 px.

/** Lists text that overlaps other text, is clipped (overflow/ellipsis/viewport) or spills out of its control. */
async function textProblems(page: Page, width = 360): Promise<string[]> {
  // page data arrives from the API worker after the first paint
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  await page.locator('details').evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
  return page.evaluate((width) => {
    type Box = { r: DOMRect; node: Text; fixed: boolean; text: string };
    const problems: string[] = [];
    // mobile browsers widen the layout viewport to fit too-wide content, so compare with the target width
    if (document.documentElement.scrollWidth > width) problems.push(`page is ${document.documentElement.scrollWidth}px wide`);
    const boxes: Box[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      const text = n.textContent?.trim();
      const el = n.parentElement;
      if (!text || !el || el.closest('select, option, script, style, .visually-hidden, [hidden], [aria-hidden="true"]')) continue;
      if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: false })) continue;
      let fixed = false;
      for (let a: Element | null = el; a; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') fixed = true;
      const range = document.createRange();
      range.selectNodeContents(n);
      // nearest scroll/clip box: text scrolled out of view vertically is hidden, not a problem
      let clip: DOMRect | null = null;
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).overflowY !== 'visible') {
          clip = a.getBoundingClientRect();
          break;
        }
      }
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        if (clip && (r.bottom <= clip.top + 1 || r.top >= clip.bottom - 1)) continue;
        const top = clip ? Math.max(r.top, clip.top) : r.top;
        const bottom = clip ? Math.min(r.bottom, clip.bottom) : r.bottom;
        boxes.push({ r: new DOMRect(r.x, top, r.width, bottom - top), node: n, fixed, text });
      }
    }
    // a closed select shows only as much of the chosen option as fits
    const ruler = document.createElement('span');
    ruler.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
    document.body.append(ruler);
    for (const sel of document.querySelectorAll('select')) {
      if (!sel.checkVisibility() || sel.selectedIndex < 0) continue;
      const cs = getComputedStyle(sel);
      ruler.style.font = cs.font;
      ruler.textContent = sel.options[sel.selectedIndex]!.text;
      const room = sel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 16; // arrow
      if (ruler.offsetWidth > room) problems.push(`select clipped: "${ruler.textContent}"`);
    }
    ruler.remove();
    const outside = (r: DOMRect, c: DOMRect) => r.left < c.left - 1 || r.right > c.right + 1;
    for (const { r, node, text } of boxes) {
      if (r.left < -1 || r.right > width + 1) problems.push(`off-screen: "${text}"`);
      const el = node.parentElement!;
      const control = el.closest('button, a, .chip, .badge');
      if (control && outside(r, control.getBoundingClientRect())) problems.push(`spills out of control: "${text}"`);
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== 'visible') {
          if (outside(r, a.getBoundingClientRect())) problems.push(`clipped: "${text}"`);
          break;
        }
      }
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        if (a.node === b.node || a.fixed !== b.fixed) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > 1 && h > 2) problems.push(`overlap: "${a.text}" / "${b.text}"`);
      }
    }
    return [...new Set(problems)];
  }, width);
}

for (const locale of ['de', 'en-XA']) {
  test.describe(`text fits at 360 px in ${locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
    });

    const useLocale = async (page: Page) => {
      await page.evaluate((language) => {
        localStorage.setItem('cuplog:prefs', JSON.stringify({ language }));
      }, locale);
    };

    test('log screen (all levels) and café mode', async ({ page }) => {
      await addBag(page);
      await useLocale(page);
      await page.goto('./#/log');
      await page.reload();
      const levels = page.locator('[aria-labelledby="rate-level"] [role="radio"]');
      await expect(levels).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        await levels.nth(i).click();
        await page.locator('details').evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
        expect(await textProblems(page), `level ${i}`).toEqual([]);
      }
      await page.goto('./#/log?mode=cafe');
      await page.locator('details').evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
      expect(await textProblems(page)).toEqual([]);
    });

    for (const path of ['#/products/new', '#/bags/new', '#/settings', '#/bags', '#/ratings', '#/stats', '#/venues']) {
      test(path, async ({ page }) => {
        await page.goto('./#/bags');
        await useLocale(page);
        await page.goto(`./${path}`);
        await page.reload();
        await page.locator('h1').first().waitFor();
        await page.locator('details').evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
        expect(await textProblems(page)).toEqual([]);
      });
    }

    test('catalog picker results and the picked entry', async ({ page }) => {
      await loadCatalog(page);
      await useLocale(page);
      await page.goto('./#/bags/new');
      await page.reload();
      await page.getByRole('searchbox').fill('man versus');
      await expect(page.getByTestId('catalog-result').first()).toBeVisible();
      expect(await textProblems(page), 'results').toEqual([]);
      await page.getByTestId('catalog-result').nth(1).click();
      await expect(page.getByTestId('catalog-picked')).toBeVisible();
      expect(await textProblems(page), 'picked').toEqual([]);
    });

    test('welcome flow', async ({ page }) => {
      await page.goto('./#/bags');
      await useLocale(page);
      await page.goto('./#/welcome');
      await page.reload();
      for (let step = 0; step < 4; step++) {
        await page.locator('h1').first().waitFor();
        expect(await textProblems(page), `step ${step}`).toEqual([]);
        const next = page.getByTestId('welcome-next');
        if (!(await next.isVisible())) break;
        await next.click();
      }
    });
  });
}
