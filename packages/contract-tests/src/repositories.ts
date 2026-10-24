import { describe, expect, it } from 'vitest';
import { defaultSettings, LOCAL_OWNER } from '@cuplog/core';
import { makeRating } from '@cuplog/core/testing';
import type { Bag, Product, Venue } from '@cuplog/core';
import type { Repositories } from '@cuplog/services';

const meta = (id: string, ownerId = LOCAL_OWNER) => ({
  id,
  ownerId,
  createdAt: '2026-10-16T08:00:00+02:00',
  updatedAt: '2026-10-16T08:00:00+02:00',
  deletedAt: null as string | null,
  rev: 1,
});

export const product = (id: string, ownerId = LOCAL_OWNER): Product => ({
  ...meta(id, ownerId),
  catalogId: null,
  roaster: 'Vits der Kaffee',
  name: `Product ${id}`,
  origin: { country: 'Ethiopia', region: 'Guji', farm: null, altitudeM: 2100 },
  process: 'natural',
  varietals: ['Heirloom'],
  roastLevel: 2,
  roastFor: ['filter'],
  isBlend: false,
  labelNotes: ['blueberry'],
  decaf: false,
  favourite: false,
  barcode: null,
  photoMediaId: null,
});

export const bag = (id: string, productId: string, ownerId = LOCAL_OWNER): Bag => ({
  ...meta(id, ownerId),
  productId,
  label: 'Bag #3',
  weightG: 250,
  priceEur: 16.9,
  shop: 'Vits, Rumfordstraße',
  purchasedAt: '2026-10-05',
  roastDate: '2026-10-02',
  expiryDate: '2027-04-02',
  openedAt: null,
  finishedAt: null,
  form: 'beans',
  storage: '',
  notes: '',
});

export const venue = (id: string): Venue => ({
  ...meta(id),
  name: 'Vits',
  address: 'Rumfordstraße',
  lat: 48.13,
  lng: 11.58,
  catalogSellerId: null,
  lastDrink: null,
});

/**
 * Repository contract (README §8.6): every storage adapter must pass this suite.
 * `make` must return fresh, empty repositories.
 */
export function describeRepositoryContract(name: string, make: () => Promise<Repositories> | Repositories): void {
  describe(`repository contract: ${name}`, () => {
    it('round-trips records unchanged', async () => {
      const repos = await make();
      const p = product('p1');
      await repos.products.put(p);
      expect(await repos.products.get(LOCAL_OWNER, 'p1')).toEqual(p);
      const r = makeRating({
        id: 'r1',
        level: 'advanced',
        overall: 4,
        strength: 3,
        profile: { acidity: 4, sweetness: 3 },
        flavourTags: ['berry', 'floral'],
        wish: { sweetness: 'more' },
        brew: { method: 'flairNeo', doseG: 16, yieldG: 36, timeS: 40, methodParams: { kind: 'flairNeo', basket: 'flowControl', preheat: true, preinfusionS: 8, pressure: 'medium' } },
        meal: { type: 'sweet', note: 'Croissant' },
      });
      await repos.ratings.put(r);
      expect(await repos.ratings.get(LOCAL_OWNER, 'r1')).toEqual(r);
      const v = venue('v1');
      await repos.venues.put(v);
      expect(await repos.venues.get(LOCAL_OWNER, 'v1')).toEqual(v);
    });

    it('catalog: putMany upserts by id, get/list/count', async () => {
      const repos = await make();
      const c = (id: string, name: string) => ({
        id, roaster: 'Vits der Kaffee', roasterCity: 'München', name, originCountries: ['ET'], region: null, process: null,
        varietals: [], roastLevel: 2, roastFor: ['filter' as const], tastingNotes: ['Jasmin'], weightG: 250, priceEur: null,
        url: null, available: false, updatedAt: '2026-10-17', source: 'munich',
      });
      await repos.catalog.putMany([c('a', 'A'), c('b', 'B')]);
      await repos.catalog.putMany([c('a', 'A2')]);
      expect(await repos.catalog.count()).toBe(2);
      expect(await repos.catalog.get('a')).toEqual(c('a', 'A2'));
      expect(await repos.catalog.get('zz')).toBeUndefined();
      expect((await repos.catalog.list()).map((x) => x.id).sort()).toEqual(['a', 'b']);
    });

    it('put replaces', async () => {
      const repos = await make();
      await repos.products.put(product('p1'));
      await repos.products.put({ ...product('p1'), name: 'Renamed', rev: 2 });
      expect((await repos.products.get(LOCAL_OWNER, 'p1'))?.name).toBe('Renamed');
      expect(await repos.products.list(LOCAL_OWNER)).toHaveLength(1);
    });

    it('isolates owners', async () => {
      const repos = await make();
      await repos.products.put(product('p1'));
      await repos.products.put(product('p2', 'someone-else'));
      expect((await repos.products.list(LOCAL_OWNER)).map((p) => p.id)).toEqual(['p1']);
      expect(await repos.products.get(LOCAL_OWNER, 'p2')).toBeUndefined();
      await repos.products.clear(LOCAL_OWNER);
      expect(await repos.products.list('someone-else')).toHaveLength(1);
    });

    it('hides soft-deleted records from lists unless asked', async () => {
      const repos = await make();
      await repos.products.put(product('p1'));
      await repos.products.put({ ...product('p2'), deletedAt: '2026-10-16T09:00:00+02:00' });
      expect((await repos.products.list(LOCAL_OWNER)).map((p) => p.id)).toEqual(['p1']);
      expect(await repos.products.list(LOCAL_OWNER, { includeDeleted: true })).toHaveLength(2);
      expect(await repos.products.get(LOCAL_OWNER, 'p2')).toBeDefined();
    });

    it('lists sorted by id', async () => {
      const repos = await make();
      for (const id of ['c', 'a', 'b']) await repos.products.put(product(id));
      expect((await repos.products.list(LOCAL_OWNER)).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    });

    it('finds ratings by bag, product, venue and time', async () => {
      const repos = await make();
      await repos.ratings.put(makeRating({ id: 'r1', bagId: 'b1', productId: 'p1', ratedAt: '2026-10-14T08:00:00+02:00' }));
      await repos.ratings.put(makeRating({ id: 'r2', bagId: 'b2', productId: 'p1', ratedAt: '2026-10-15T08:00:00+02:00' }));
      await repos.ratings.put(
        makeRating({ id: 'r3', source: 'cafe', bagId: null, productId: null, brew: undefined, venueId: 'v1', cafe: { drink: 'espresso' }, ratedAt: '2026-10-16T06:30:00+00:00' }),
      );
      await repos.ratings.put(makeRating({ id: 'r4', bagId: 'b1', productId: 'p1', deletedAt: '2026-10-16T00:00:00+02:00' }));
      const ids = async (f: Parameters<typeof repos.ratings.find>[1]) => (await repos.ratings.find(LOCAL_OWNER, f)).map((r) => r.id);
      expect(await ids({ bagId: 'b1' })).toEqual(['r1']);
      expect(await ids({ bagId: 'b1', includeDeleted: true })).toEqual(['r1', 'r4']);
      expect(await ids({ productId: 'p1' })).toEqual(['r1', 'r2']);
      expect(await ids({ venueId: 'v1' })).toEqual(['r3']);
      // compared as instants, not strings: 06:30Z = 08:30+02:00
      expect(await ids({ since: '2026-10-16T08:15:00+02:00' })).toEqual(['r3']);
      expect(await ids({})).toEqual(['r1', 'r2', 'r3']);
    });

    it('lists bags by product', async () => {
      const repos = await make();
      await repos.bags.put(bag('b1', 'p1'));
      await repos.bags.put(bag('b2', 'p2'));
      expect((await repos.bags.listByProduct(LOCAL_OWNER, 'p1')).map((b) => b.id)).toEqual(['b1']);
    });

    it('stores settings and device state', async () => {
      const repos = await make();
      expect(await repos.settings.get(LOCAL_OWNER)).toBeUndefined();
      const s = { ...defaultSettings(), halfLifeDays: 30 };
      await repos.settings.put(LOCAL_OWNER, s);
      expect(await repos.settings.get(LOCAL_OWNER)).toEqual(s);
      await repos.device.set('reminderState', { rem_1: { shownOn: '2026-10-16' } });
      expect(await repos.device.get('reminderState')).toEqual({ rem_1: { shownOn: '2026-10-16' } });
      expect(await repos.device.get('missing')).toBeUndefined();
    });

    it('unit of work is atomic', async () => {
      const repos = await make();
      await expect(
        repos.uow.run(async () => {
          await repos.products.put(product('p1'));
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      // the in-memory reference adapter has no rollback; real adapters must roll back
      const atomic = (repos as { atomic?: boolean }).atomic !== false;
      if (atomic) expect(await repos.products.get(LOCAL_OWNER, 'p1')).toBeUndefined();
    });
  });
}
