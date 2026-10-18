import { CATALOG_CSV_COLUMNS } from '@cuplog/core';
import { describe, expect, it } from 'vitest';
import { isDomainError } from './errors';
import { makeTestService } from './testing';
import { createMemoryRepos } from './memory';

const HEADER = CATALOG_CSV_COLUMNS.join(',');
const line = (id: string, name: string, updated = '2026-10-17', extra = '') =>
  `${id},Vits der Kaffee,München,${name},ET,,natural,,1,filter,Blaubeere${extra},250,16.90,,true,${updated}`;
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n');

describe('catalog', () => {
  it('imports a region through CatalogSource, then upserts only newer rows', async () => {
    let file = csv(line('vits-guji', 'Guji'), line('vits-huila', 'Huila'));
    const { svc } = makeTestService(undefined, createMemoryRepos(), { fetchRegion: async () => file });
    expect(await svc.loadRegionCatalog()).toEqual({ source: 'munich', rows: 2, added: 2, updated: 0, unchanged: 0, skipped: [] });
    const info = await svc.getCatalogInfo();
    expect(info).toMatchObject({ count: 2, meta: { source: 'munich', fileName: null, updatedAt: '2026-10-17' } });

    file = csv(line('vits-guji', 'Guji Natural', '2026-10-24'), line('vits-huila', 'Huila renamed'), line('vits-new', 'New', '2026-10-24'), 'bad,row');
    const r = await svc.loadRegionCatalog('munich');
    expect(r).toMatchObject({ rows: 3, added: 1, updated: 1, unchanged: 1 });
    expect(r.skipped.length).toBeGreaterThan(0);
    expect((await svc.getCatalogProduct('vits-guji')).name).toBe('Guji Natural');
    // same updated_at → kept as it was
    expect((await svc.getCatalogProduct('vits-huila')).name).toBe('Huila');
    expect((await svc.getCatalogInfo()).meta?.updatedAt).toBe('2026-10-24');
  });

  it("never touches the user's products, bags or ratings", async () => {
    const { svc, repos } = makeTestService();
    const p = await svc.addProduct({ roaster: 'Vits der Kaffee', name: 'Guji', catalogId: 'vits-guji' });
    const b = await svc.addBag({ productId: p.id });
    await svc.logRating({ level: 'swipe', swipe: 'more', source: 'home', bagId: b.id, brew: { method: 'aeropress' } });
    const before = JSON.stringify([await repos.products.list('local'), await repos.bags.list('local'), await repos.ratings.list('local')]);
    await svc.importCatalogCsv(csv(line('vits-guji', 'Guji', '2026-12-01')), 'mine.csv');
    expect(JSON.stringify([await repos.products.list('local'), await repos.bags.list('local'), await repos.ratings.list('local')])).toBe(before);
    expect((await svc.getCatalogInfo()).meta).toMatchObject({ source: 'file', fileName: 'mine.csv' });
  });

  it('reports bad files and missing sources as error codes', async () => {
    const { svc } = makeTestService();
    const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (isDomainError(e) ? e.code : 'other'));
    expect(await code(svc.importCatalogCsv('id,name\nx,y'))).toBe('CATALOG_CSV_HEADER');
    expect(await code(svc.importCatalogCsv(csv('bad,row')))).toBe('CATALOG_CSV_EMPTY');
    expect(await code(svc.loadRegionCatalog())).toBe('CATALOG_UNAVAILABLE');
    await svc.updateSettings({ catalogRegion: null });
    expect(await code(svc.loadRegionCatalog())).toBe('CATALOG_NO_REGION');
    const offline = makeTestService(undefined, createMemoryRepos(), { fetchRegion: async () => Promise.reject(new Error('offline')) });
    expect(await code(offline.svc.loadRegionCatalog())).toBe('CATALOG_UNAVAILABLE');
    expect(await code(svc.getCatalogProduct('nope'))).toBe('NOT_FOUND');
  });

  it('searches with localised origin names', async () => {
    const { svc } = makeTestService();
    await svc.importCatalogCsv(csv(line('vits-guji', 'Guji'), line('vits-huila', 'Huila').replace(',ET,', ',CO,')));
    expect((await svc.searchCatalog({ text: 'äthiop', originNames: { ET: 'Äthiopien', CO: 'Kolumbien' } })).map((p) => p.id)).toEqual(['vits-guji']);
    expect(await svc.searchCatalog({})).toHaveLength(2);
  });
});
