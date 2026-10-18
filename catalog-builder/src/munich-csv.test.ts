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

it('the flavour lexicon covers the Munich tasting notes', async () => {
  const { noteFlavour } = await import('@cuplog/core');
  const text = readFileSync(new URL('../../apps/pwa/public/catalog/munich.csv', import.meta.url), 'utf8');
  const res = parseCatalogCsv(text, 'munich');
  if (!res.ok) throw new Error('invalid');
  const notes = [...new Set(res.products.flatMap((p) => p.tastingNotes))];
  const unmapped = notes.filter((n) => !noteFlavour(n));
  // descriptors (body, acidity, "elegant") are expected to stay unmapped; flavour words must not
  console.log(`flavour lexicon: ${notes.length - unmapped.length}/${notes.length} distinct notes mapped; unmapped: ${unmapped.join(', ')}`);
  expect(unmapped.length / notes.length).toBeLessThan(0.15);
});
