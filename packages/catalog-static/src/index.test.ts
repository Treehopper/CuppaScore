import { expect, it } from 'vitest';
import { staticCatalogSource } from './index';

it('fetches <base>catalog/<region>.csv and reports HTTP errors', async () => {
  const urls: string[] = [];
  const ok = staticCatalogSource('https://x.github.io/CuppaScore/', async (u) => {
    urls.push(String(u));
    return new Response('id,roaster');
  });
  expect(await ok.fetchRegion('munich')).toBe('id,roaster');
  expect(urls).toEqual(['https://x.github.io/CuppaScore/catalog/munich.csv']);
  const missing = staticCatalogSource('https://x/', async () => new Response('', { status: 404 }));
  await expect(missing.fetchRegion('munich')).rejects.toThrow('HTTP 404');
});
