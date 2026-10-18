import { readFileSync } from 'node:fs';
import { catalogUpdatedAt, parseCatalogCsv } from '@cuplog/core';
import { expect, it } from 'vitest';

it('the shipped Munich catalog CSV validates without skipping a row', () => {
  const text = readFileSync(new URL('../../apps/pwa/public/catalog/munich.csv', import.meta.url), 'utf8');
  const res = parseCatalogCsv(text, 'munich');
  if (!res.ok) throw new Error(JSON.stringify(res.problem));
  expect(res.skipped).toEqual([]);
  expect(res.products.length).toBeGreaterThanOrEqual(150);
  expect(new Set(res.products.map((p) => p.roaster)).size).toBeGreaterThanOrEqual(10);
  expect(catalogUpdatedAt(res.products)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
