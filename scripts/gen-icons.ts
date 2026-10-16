// Renders apps/pwa/public/icons/icon.svg to the PNG sizes the manifest and iOS need.
// Run manually after changing the SVG: `node scripts/gen-icons.ts` (uses the preinstalled Chromium).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'apps', 'pwa', 'public', 'icons');
const svg = readFileSync(join(dir, 'icon.svg'), 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const targets: { file: string; size: number; maskable?: boolean }[] = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-192.png', size: 192, maskable: true },
  { file: 'maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  // maskable: full-bleed background, artwork shrunk into the 80 % safe zone
  const img = t.maskable
    ? `<div style="width:100%;height:100%;background:#1e1410;display:grid;place-items:center"><img src="${dataUrl}" style="width:80%;height:80%"></div>`
    : `<img src="${dataUrl}" style="width:100%;height:100%">`;
  await page.setContent(`<html><body style="margin:0;background:transparent">${img}</body></html>`);
  await page.screenshot({ path: join(dir, t.file), omitBackground: !t.maskable });
  console.log(`wrote ${t.file}`);
}
await browser.close();
