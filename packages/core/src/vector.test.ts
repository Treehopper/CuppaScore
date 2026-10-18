import { describe, expect, it } from 'vitest';
import type { CatalogProduct } from './catalogCsv';
import { makeProduct } from './testing';
import {
  catalogProductFeatures,
  cosine,
  countryCodes,
  FEATURE_DIMS,
  featureVector,
  sharedDims,
  tasteProfile,
  userProductFeatures,
  wishShift,
} from './vector';

const cat = (o: Partial<CatalogProduct>): CatalogProduct => ({
  id: 'x', roaster: 'R', roasterCity: null, name: 'C', originCountries: [], region: null, process: null, varietals: [], roastLevel: null,
  roastFor: [], tastingNotes: [], weightG: null, priceEur: null, url: null, available: true, updatedAt: '2026-10-17', source: 'munich', ...o,
});

const fruityEthiopia = cat({ id: 'eth', originCountries: ['ET'], process: 'natural', roastLevel: 1, roastFor: ['filter'], tastingNotes: ['Blaubeere', 'Jasmin', 'Zitrone'] });
const fruityKenya = cat({ id: 'ken', originCountries: ['KE'], process: 'washed', roastLevel: 1, roastFor: ['filter'], tastingNotes: ['Johannisbeere', 'Grapefruit'] });
const chocBrazil = cat({ id: 'bra', originCountries: ['BR'], process: 'natural', roastLevel: 3, roastFor: ['espresso'], tastingNotes: ['Dunkle Schokolade', 'Haselnuss'] });
const vec = (c: CatalogProduct) => featureVector(catalogProductFeatures(c));

describe('feature vectors (§7.1)', () => {
  it('has the documented layout and weights blocks as in the table', () => {
    expect(FEATURE_DIMS).toHaveLength(8 + 4 + 1 + 5 + 5 + 3);
    const v = vec(fruityEthiopia);
    expect(v).toHaveLength(FEATURE_DIMS.length);
    // every block present → squared length = Σ weights = 1
    expect(v.reduce((s, x) => s + x * x, 0)).toBeCloseTo(1, 6);
  });

  it('similar coffees are closer than different ones', () => {
    expect(cosine(vec(fruityEthiopia), vec(fruityKenya))).toBeGreaterThan(cosine(vec(fruityEthiopia), vec(chocBrazil)));
    expect(cosine(vec(chocBrazil), vec(chocBrazil))).toBeCloseTo(1, 9);
    expect(cosine([0, 0], [1, 0])).toBe(0);
  });

  it('a block without information doesn’t take part', () => {
    const v = vec(cat({ roastLevel: 2 }));
    expect(v.every((x) => x === 0)).toBe(true); // medium roast is 0, nothing else known
  });
});

describe('user products', () => {
  it('reads origin from free text in four languages', () => {
    expect(countryCodes('Äthiopien')).toEqual(['ET']);
    expect(countryCodes('Brasilien, Kolumbien')).toEqual(['BR', 'CO']);
    expect(countryCodes('Costa Rica')).toEqual(['CR']);
    expect(countryCodes('El Salvador')).toEqual(['SV']);
    expect(countryCodes('Sumatra')).toEqual(['ID']);
    expect(countryCodes('BR;CO')).toEqual(['BR', 'CO']);
    expect(countryCodes('Bavaria')).toEqual([]);
    expect(countryCodes(null)).toEqual([]);
  });

  it('combines label notes with flavour tags and prefers the catalog origin', () => {
    const p = makeProduct({ labelNotes: ['Schokolade'], origin: { country: 'Brasilien', region: null, farm: null, altitudeM: null } });
    const f = userProductFeatures(p, { flavourTags: ['berry', 'berry'] });
    expect(f.flavour).toMatchObject({ chocolate: 1, fruity: 1 });
    expect(f.originRegion).toBe('southAmerica');
    expect(userProductFeatures(p, { catalog: fruityKenya }).originRegion).toBe('eastAfrica');
  });

  it('uses catalog notes when the label has none, and marks blends', () => {
    const p = makeProduct({ isBlend: true, origin: { country: 'Brasilien, Äthiopien', region: null, farm: null, altitudeM: null } });
    expect(userProductFeatures(p, { catalog: chocBrazil }).flavour.chocolate).toBe(1);
    expect(userProductFeatures(p).originRegion).toBe('blend');
  });

  it('your sliders replace the sensory prior from 3 detailed cups on', () => {
    const p = makeProduct({ roastLevel: 3 });
    const prior = userProductFeatures(p).sensory;
    expect(userProductFeatures(p, { profile: { acidity: 5 }, advancedCount: 2 }).sensory).toEqual(prior);
    const mine = userProductFeatures(p, { profile: { acidity: 5, body: 1 }, advancedCount: 3 }).sensory;
    expect(mine).toMatchObject({ acidity: 1, body: 0, bitterness: prior.bitterness });
  });
});

describe('taste profile (§7.2)', () => {
  it('liked products pull, disliked ones push', () => {
    const profile = tasteProfile([
      { vector: vec(fruityEthiopia), p: 0.8 },
      { vector: vec(chocBrazil), p: -0.6 },
    ])!;
    expect(cosine(profile, vec(fruityKenya))).toBeGreaterThan(0.5);
    expect(cosine(profile, vec(chocBrazil))).toBeLessThan(0);
    expect(Math.hypot(...profile)).toBeCloseTo(1, 9);
  });

  it('is null without information', () => {
    expect(tasteProfile([])).toBeNull();
    expect(tasteProfile([{ vector: vec(fruityEthiopia), p: 0 }])).toBeNull();
  });

  it('wishes shift the sensory target', () => {
    const base = tasteProfile([{ vector: vec(chocBrazil), p: 1 }])!;
    const shift = wishShift({ sweetness: { more: 3, justRight: 1 }, bitterness: { less: 2 } })!;
    const shifted = tasteProfile([{ vector: vec(chocBrazil), p: 1 }], shift)!;
    const i = FEATURE_DIMS.indexOf('sensory.sweetness');
    const j = FEATURE_DIMS.indexOf('sensory.bitterness');
    expect(shifted[i]!).toBeGreaterThan(base[i]!);
    expect(shifted[j]!).toBeLessThan(base[j]!);
    expect(wishShift({})).toBeNull();
  });

  it('names what two coffees share', () => {
    const shared = sharedDims(vec(fruityEthiopia), vec(fruityKenya), 4);
    expect(shared).toEqual(expect.arrayContaining(['sensory.acidity', 'roast', 'flavour.fruity']));
    expect(sharedDims(vec(fruityEthiopia), vec(chocBrazil), 4)).not.toContain('flavour.fruity');
  });
});
