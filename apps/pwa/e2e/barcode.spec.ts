import { expect, test, type Page } from '@playwright/test';

// A2: the camera is faked with a canvas stream showing a real EAN-13, decoded by the bundled
// zxing-wasm ponyfill (headless Chromium on Linux has no native BarcodeDetector).

/** Replaces getUserMedia with a canvas stream that shows `code` as an EAN-13 barcode. */
async function fakeCamera(page: Page, code: string): Promise<void> {
  await page.addInitScript((digits) => {
    const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
    const R = L.map((p) => [...p].map((b) => (b === '0' ? '1' : '0')).join(''));
    const G = R.map((p) => [...p].reverse().join(''));
    const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
    const d = [...digits].map(Number);
    let bits = '101';
    for (let i = 1; i <= 6; i++) bits += (PARITY[d[0]!]![i - 1] === 'L' ? L : G)[d[i]!];
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += R[d[i]!];
    bits += '101';
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      const draw = () => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = '#000';
        [...bits].forEach((b, i) => b === '1' && ctx.fillRect(40 + i * 5, 120, 5, 240));
        requestAnimationFrame(draw);
      };
      draw();
      return canvas.captureStream(10);
    };
  }, code);
}

const KNOWN = '4006381333931';
const UNKNOWN = '5901234123457';

test('scan in Add bag: unknown code → add the product with the barcode, next scan finds it', async ({ page }) => {
  await fakeCamera(page, UNKNOWN);
  await page.goto('./#/bags/new');
  await page.getByTestId('scan-barcode').click();
  await expect(page.getByRole('heading', { name: 'Add product' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('New barcode')).toBeVisible();
  await expect(page.getByTestId('product-barcode')).toHaveValue(UNKNOWN);
  await page.getByLabel('Roaster').fill('Dallmayr');
  await page.getByLabel('Name').fill('Prodomo');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Add bag' })).toBeVisible();

  await page.goto('./#/products/new');
  await page.getByLabel('Roaster').fill('Vits der Kaffee');
  await page.getByLabel('Name').fill('Guji');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Guji' })).toBeVisible();

  await page.goto('./#/bags/new');
  await expect(page.getByTestId('bag-product')).toHaveValue(/.+/);
  await page.getByTestId('scan-barcode').click();
  await expect(page.getByText('Found: Dallmayr – Prodomo')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('bag-product').locator('option:checked')).toHaveText('Dallmayr – Prodomo');
});

test('product form: scan or type a barcode; invalid numbers are refused', async ({ page }) => {
  await fakeCamera(page, KNOWN);
  await page.goto('./#/products/new');
  await page.getByLabel('Roaster').fill('Vits der Kaffee');
  await page.getByLabel('Name').fill('Guji');
  await page.getByTestId('product-barcode').fill('4006381333932');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Not a valid EAN/UPC number.')).toBeVisible();
  await page.getByTestId('scan-barcode').click();
  await expect(page.getByTestId('product-barcode')).toHaveValue(KNOWN, { timeout: 15_000 });
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Guji' })).toBeVisible();
});

test('camera denied shows a hint and the dialog closes', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };
  });
  await page.goto('./#/products/new');
  await page.getByTestId('scan-barcode').click();
  await expect(page.getByText('Camera access was denied')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});
