import { describe, expect, it } from 'vitest';
import type { CatalogProduct } from './catalogCsv';
import { seededRng } from './ports';
import { exploreDims, methodMatch, pricePenalty, pricePerKg, recommend, type RatedProduct, type RecoCandidate } from './recommend';
import { catalogProductFeatures, featureVector, tasteProfile } from './vector';

const cat = (id: string, o: Partial<CatalogProduct>): CatalogProduct => ({
  id, roaster: 'R', roasterCity: null, name: id, originCountries: [], region: null, process: null, varietals: [], roastLevel: null,
  roastFor: [], tastingNotes: [], weightG: 250, priceEur: 15, url: null, available: true, updatedAt: '2026-10-17', source: 'munich', ...o,
});
const cand = (c: CatalogProduct): RecoCandidate => ({ product: c, vector: featureVector(catalogProductFeatures(c)) });
const mineOf = (c: CatalogProduct, p: number | null, productId = `mine-${c.id}`): RatedProduct => {
  const v = featureVector(catalogProductFeatures(c));
  return { productId, catalogId: c.id, vector: v, p, dims: exploreDims(v) };
};

const ethiopia = cat('eth', { originCountries: ['ET'], process: 'natural', roastLevel: 1, roastFor: ['filter'], tastingNotes: ['Blaubeere', 'Jasmin'] });
const kenya = cat('ken', { originCountries: ['KE'], process: 'washed', roastLevel: 1, roastFor: ['filter'], tastingNotes: ['Johannisbeere', 'Zitrone'] });
const rwanda = cat('rwa', { originCountries: ['RW'], process: 'natural', roastLevel: 1, roastFor: ['filter', 'espresso'], tastingNotes: ['Erdbeere', 'Hibiskus'] });
const brazil = cat('bra', { originCountries: ['BR'], process: 'natural', roastLevel: 3, roastFor: ['espresso'], tastingNotes: ['Schokolade', 'Haselnuss'] });
const sumatra = cat('sum', { originCountries: ['ID'], process: 'other', roastLevel: 3, roastFor: ['espresso'], tastingNotes: ['Erdig', 'Tabak'] });
const soldOut = cat('old', { ...kenya, id: 'old', available: false });
const pricey = cat('lux', { ...rwanda, id: 'lux', priceEur: 60 });
const all = [ethiopia, kenya, rwanda, brazil, sumatra, soldOut, pricey].map(cand);

const mine = [mineOf(ethiopia, 0.8), mineOf(brazil, -0.6)];
const profile = tasteProfile(mine.map((m) => ({ vector: m.vector, p: m.p! })));

describe('recommend (§7.3)', () => {
  it('ranks by taste, excludes owned, dismissed and sold-out coffees', () => {
    const ids = recommend({ candidates: all, mine, profile, rng: seededRng(1), exploreEvery: 0 }).map((r) => r.catalogId);
    expect(ids).not.toContain('eth');
    expect(ids).not.toContain('bra');
    expect(ids).not.toContain('old');
    // fruity light East Africans first (lux is a pricier copy of rwa), the earthy dark Sumatra last
    expect(ids.slice(0, 3).sort()).toEqual(['ken', 'lux', 'rwa']);
    expect(ids.at(-1)).toBe('sum');
    expect(recommend({ candidates: all, mine, profile, rng: seededRng(1), dismissed: new Set(['rwa']), exploreEvery: 0 }).map((r) => r.catalogId)).not.toContain('rwa');
  });

  it('explains with the nearest favourite and what they share', () => {
    const top = recommend({ candidates: all, mine, profile, rng: seededRng(1), exploreEvery: 0 })[0]!;
    expect(top.explanation).toMatchObject({ kind: 'similarTo', productId: 'mine-eth' });
    expect(top.explanation.kind === 'similarTo' && top.explanation.shared.length).toBe(2);
  });

  it('penalises prices well above what you usually pay', () => {
    expect(pricePerKg(pricey)).toBe(240);
    expect(pricePenalty(240, 60)).toBe(0.2);
    expect(pricePenalty(70, 60)).toBe(0);
    expect(pricePenalty(null, 60)).toBe(0);
    const recs = recommend({ candidates: all, mine, profile, rng: seededRng(1), exploreEvery: 0, usualPricePerKg: 60 });
    const score = (id: string) => recs.find((r) => r.catalogId === id)!.score;
    expect(score('lux')).toBeLessThan(score('rwa'));
  });

  it('favours coffees roasted for your methods', () => {
    expect(methodMatch(['espresso'], ['espresso'])).toBe(1);
    expect(methodMatch(['omni'], ['filter'])).toBe(1);
    expect(methodMatch(['filter'], ['espresso'])).toBe(0);
    expect(methodMatch(['filter'], [])).toBe(0);
  });

  it('cold start: no profile → method fit first, explained as such', () => {
    const recs = recommend({ candidates: all, mine: [], profile: null, rng: seededRng(1), preferredRoastFor: ['espresso'] });
    expect(recs[0]!.explanation.kind).toBe('coldStart');
    expect(['bra', 'sum', 'rwa', 'lux']).toContain(recs[0]!.catalogId);
    expect(recs.every((r) => r.similarity === null)).toBe(true);
  });
});

describe('exploration (§7.4, D7)', () => {
  // a pool where several items sit at moderate similarity in untried regions
  const many = Array.from({ length: 30 }, (_, i) =>
    cand(cat(`c${i}`, { originCountries: [['ET', 'KE', 'CO', 'GT', 'ID', 'BR'][i % 6]!], process: (['washed', 'natural', 'honey'] as const)[i % 3], roastLevel: ((i % 3) + 1) as 1 | 2 | 3, tastingNotes: [['Beere', 'Schokolade', 'Zitrone', 'Nuss', 'Jasmin'][i % 5]!] })),
  );

  it('every 5th slot is an exploration pick, reproducible with the same rng', () => {
    const run = (seed: number) => recommend({ candidates: many, mine, profile, rng: seededRng(seed), limit: 10 });
    const a = run(7);
    expect(a).toHaveLength(10);
    const explore = a.filter((r) => r.explanation.kind === 'explore');
    expect(explore.length).toBeGreaterThanOrEqual(1);
    for (const r of explore) {
      expect([4, 9]).toContain(a.indexOf(r));
      expect(r.similarity!).toBeGreaterThanOrEqual(0.4);
      expect(r.similarity!).toBeLessThanOrEqual(0.6);
    }
    expect(run(7)).toEqual(a);
    expect(new Set(a.map((r) => r.catalogId)).size).toBe(10);
  });
});
