import { CATALOG_CSV_COLUMNS } from '@cuplog/core';
import { makeRating } from '@cuplog/core/testing';
import { describe, expect, it } from 'vitest';
import { preferredRoastFor, usualPricePerKg } from './recommendations';
import { makeTestService } from './testing';

const HEADER = CATALOG_CSV_COLUMNS.join(',');
// id,roaster,roaster_city,name,origin_countries,region,process,varieties,roast_level,roast_for,tasting_notes,weight_g,price_eur,url,available,updated_at
const CSV = [
  HEADER,
  'vits-guji,Vits der Kaffee,München,Guji,ET,,natural,,1,filter,Blaubeere;Jasmin,250,16.90,,true,2026-10-17',
  'vits-kenya,Vits der Kaffee,München,Kenia Nyeri,KE,,washed,,1,filter,Johannisbeere;Zitrone,250,17.90,,true,2026-10-17',
  'mvm-rwanda,Man versus Machine,München,Rwanda,RW,,natural,,1,filter;espresso,Erdbeere;Hibiskus,250,18.90,,true,2026-10-17',
  'dallmayr-crema,Dallmayr,München,Crema d’Oro,BR;CO,,,,3,espresso,Schokolade;Nuss,1000,,,true,2026-10-17',
  'wild-brasil,Wildkaffee,Farchant,Brasil Cerrado,BR,,natural,,3,espresso,Schokolade;Haselnuss,250,14.50,,true,2026-10-17',
  'mvm-decaf,Man versus Machine,München,Decaf de Caña,CO,,other,,2,omni,Karamell;Beere,250,19.90,,true,2026-10-17',
  'vits-sold,Vits der Kaffee,München,Kenia Old,KE,,washed,,1,filter,Johannisbeere,250,15.00,,false,2026-10-17',
].join('\n');

async function setup() {
  const t = makeTestService('2026-10-18T09:00:00+02:00');
  await t.svc.importCatalogCsv(CSV);
  const guji = await t.svc.addProduct({ roaster: 'Vits der Kaffee', name: 'Guji', catalogId: 'vits-guji', labelNotes: ['Blaubeere', 'Jasmin'], process: 'natural', roastLevel: 1, origin: { country: 'Äthiopien' } });
  const brasil = await t.svc.addProduct({ roaster: 'Wildkaffee', name: 'Brasil', catalogId: 'wild-brasil', process: 'natural', roastLevel: 3 });
  const gb = await t.svc.addBag({ productId: guji.id, priceEur: 16.9, weightG: 250 });
  const bb = await t.svc.addBag({ productId: brasil.id, priceEur: 14.5, weightG: 250 });
  for (let i = 0; i < 3; i++) {
    await t.svc.logRating({ level: 'stars', overall: 5, source: 'home', bagId: gb.id, brew: { method: 'v60' } });
    await t.svc.logRating({ level: 'stars', overall: 1.5, source: 'home', bagId: bb.id, brew: { method: 'v60' } });
  }
  return { ...t, guji, brasil };
}

describe('getRecommendations', () => {
  it('recommends similar coffees first, explains with the favourite, skips owned/sold-out/decaf', async () => {
    const { svc, guji } = await setup();
    const r = await svc.getRecommendations();
    const ids = r.items.map((x) => x.item.id);
    expect(ids).not.toContain('vits-guji');
    expect(ids).not.toContain('wild-brasil');
    expect(ids).not.toContain('vits-sold');
    expect(ids).not.toContain('mvm-decaf');
    expect(ids.slice(0, 2).sort()).toEqual(['mvm-rwanda', 'vits-kenya']);
    expect(ids.at(-1)).toBe('dallmayr-crema');
    const top = r.items[0]!;
    expect(top.explanation.kind).toBe('similarTo');
    expect(top.similarProduct).toEqual({ id: guji.id, roaster: 'Vits der Kaffee', name: 'Guji' });
    expect(top.pricePerKg).toBeGreaterThan(60);
    expect(r).toMatchObject({ ratedProducts: 2, coldStart: true });
  });

  it('filters by method, price, roaster and decaf', async () => {
    const { svc } = await setup();
    const ids = async (q: Parameters<typeof svc.getRecommendations>[0]) => (await svc.getRecommendations(q)).items.map((x) => x.item.id).sort();
    expect(await ids({ roastFor: 'espresso' })).toEqual(['dallmayr-crema', 'mvm-rwanda']);
    expect(await ids({ maxPricePerKg: 70 })).toEqual([]);
    expect(await ids({ maxPricePerKg: 72 })).toEqual(['vits-kenya']);
    expect(await ids({ roaster: 'Man versus Machine' })).toEqual(['mvm-rwanda']);
    expect(await ids({ roaster: 'Man versus Machine', includeDecaf: true })).toEqual(['mvm-decaf', 'mvm-rwanda']);
  });

  it('wishlist and dismiss', async () => {
    const { svc } = await setup();
    await svc.setWishlist('vits-kenya', true);
    expect((await svc.getRecommendations()).items.find((x) => x.item.id === 'vits-kenya')?.wishlisted).toBe(true);
    expect((await svc.listWishlist()).map((c) => c.id)).toEqual(['vits-kenya']);
    await svc.dismissRecommendation('vits-kenya');
    expect((await svc.getRecommendations()).items.map((x) => x.item.id)).not.toContain('vits-kenya');
    expect(await svc.listWishlist()).toEqual([]);
    await svc.restoreDismissed();
    expect((await svc.getRecommendations()).items.map((x) => x.item.id)).toContain('vits-kenya');
    await svc.setWishlist('mvm-rwanda', true);
    await svc.setWishlist('mvm-rwanda', false);
    expect(await svc.listWishlist()).toEqual([]);
    expect(await svc.listCatalogRoasters()).toEqual(['Dallmayr', 'Man versus Machine', 'Vits der Kaffee', 'Wildkaffee']);
  });

  it('is stable within a day (exploration seeded by date)', async () => {
    const { svc } = await setup();
    expect(await svc.getRecommendations()).toEqual(await svc.getRecommendations());
  });

  it('works with no ratings (cold start) and an empty catalog', async () => {
    const t = makeTestService();
    expect(await t.svc.getRecommendations()).toEqual({ items: [], ratedProducts: 0, coldStart: true });
    await t.svc.importCatalogCsv(CSV);
    const r = await t.svc.getRecommendations();
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((x) => x.explanation.kind === 'coldStart' && x.similarity === null)).toBe(true);
  });
});

describe('inputs', () => {
  it('preferred roast from the methods you use', () => {
    const r = (method: 'v60' | 'espressoMachine' | 'aeropress') => makeRating({ brew: { method } });
    expect(preferredRoastFor([r('v60'), r('v60'), r('espressoMachine')])).toEqual(['espresso', 'filter']);
    expect(preferredRoastFor([r('v60'), r('v60'), r('v60'), r('espressoMachine')])).toEqual(['filter']);
    expect(preferredRoastFor([r('aeropress')])).toEqual([]);
    expect(preferredRoastFor([])).toEqual([]);
  });

  it('usual price is the 75th percentile per kg', () => {
    expect(usualPricePerKg([{ priceEur: 10, weightG: 250 }, { priceEur: 20, weightG: 250 }, { priceEur: 30, weightG: 1000 }, { priceEur: null, weightG: 250 }])).toBe(80); // 30, 40, 80 €/kg
    expect(usualPricePerKg([])).toBeNull();
  });
});
