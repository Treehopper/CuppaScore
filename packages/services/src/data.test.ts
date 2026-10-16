import { describe, expect, it } from 'vitest';
import { isDomainError } from './errors';
import { makeTestService } from './testing';

async function seeded() {
  const t = makeTestService();
  const p = await t.svc.addProduct({ roaster: 'Vits der Kaffee', name: 'Guji, "Natural"' });
  const b = await t.svc.addBag({ productId: p.id, label: 'Bag #3' });
  const v = await t.svc.addVenue({ name: 'Vits' });
  await t.svc.logRating({ level: 'stars', overall: 4, source: 'home', bagId: b.id, brew: { method: 'aeropress', doseG: 15 }, meal: { type: 'sweet', note: 'Croissant' } });
  await t.svc.logRating({ level: 'swipe', swipe: 'less', source: 'cafe', venueId: v.id, beanKnown: 'house', cafe: { drink: 'cappuccino' } });
  await t.svc.updateSettings({ halfLifeDays: 45 });
  return { ...t, p, b, v };
}

describe('export / import', () => {
  it('round-trips through replace into an empty store', async () => {
    const a = await seeded();
    const bundle = await a.svc.exportAll();
    expect(bundle).toMatchObject({ app: 'cuplog', schemaVersion: 1 });
    const json = JSON.parse(JSON.stringify(bundle));
    const b = makeTestService();
    const report = await b.svc.importAll(json, 'replace');
    expect(report).toMatchObject({ products: { added: 1 }, ratings: { added: 2 }, venues: { added: 1 }, settings: 'replaced' });
    expect(await b.svc.exportAll()).toEqual(bundle);
  });

  it('merge keeps the newer version of each record', async () => {
    const a = await seeded();
    const old = await a.svc.exportAll();
    await a.svc.updateProduct(a.p.id, { name: 'Renamed' });
    const extra = makeTestService('2026-10-16T09:00:00+02:00');
    const p2 = await extra.svc.addProduct({ roaster: 'Supremo', name: 'Espresso' });
    const r1 = await a.svc.importAll(old, 'merge');
    expect(r1.products).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect((await a.svc.getProduct(a.p.id)).name).toBe('Renamed');
    const r2 = await a.svc.importAll(await extra.svc.exportAll(), 'merge');
    expect(r2.products.added).toBe(1);
    expect((await a.svc.getProduct(p2.id)).roaster).toBe('Supremo');
    expect(r2.settings).toBe('none');
  });

  it('replace wipes existing data', async () => {
    const a = await seeded();
    const empty = await makeTestService().svc.exportAll();
    await a.svc.importAll(empty, 'replace');
    expect(await a.svc.listRatings()).toEqual([]);
    expect((await a.svc.getSettings()).halfLifeDays).toBe(60);
  });

  it('rejects invalid bundles with codes', async () => {
    const a = await seeded();
    for (const [input, code] of [
      [{ app: 'cuplog', schemaVersion: 2 }, 'UNSUPPORTED_SCHEMA_VERSION'],
      [{ app: 'cuplog', schemaVersion: 1, ratings: 'x' }, 'IMPORT_INVALID'],
    ] as const) {
      const err = await a.svc.importAll(input, 'merge').catch((e: unknown) => e);
      expect(isDomainError(err) && err.code).toBe(code);
    }
    expect(await a.svc.listRatings()).toHaveLength(2);
  });

  it('exports ratings CSV', async () => {
    const a = await seeded();
    const lines = (await a.svc.exportRatingsCsv()).trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^id,ratedAt,level,source,roaster,product,bag/);
    expect(lines[1]).toContain('stars,home,Vits der Kaffee,"Guji, ""Natural""",Bag #3,,aeropress');
    expect(lines[1]).toContain('sweet,Croissant');
    expect(lines[2]).toContain('swipe,cafe,,,,Vits,,cappuccino,unknown');
  });
});
