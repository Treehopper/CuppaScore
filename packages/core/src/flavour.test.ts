import { describe, expect, it } from 'vitest';
import { catalogFeatures, flavourFromNotes, isDecaf, noteFlavour, originRegion, sensoryPrior, TAG_FLAVOUR } from './flavour';
import type { CatalogProduct } from './catalogCsv';
import { FLAVOUR_TAGS } from './vocab';

const product = (o: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: 'x', roaster: 'R', roasterCity: null, name: 'Coffee', originCountries: [], region: null, process: null, varietals: [],
  roastLevel: null, roastFor: [], tastingNotes: [], weightG: null, priceEur: null, url: null, available: true, updatedAt: '2026-10-17', source: 'munich',
  ...o,
});

describe('flavour lexicon', () => {
  it('maps German and English notes (case, umlauts, phrases)', () => {
    expect(noteFlavour('Dunkle Schokolade')).toEqual({ chocolate: 1 });
    expect(noteFlavour('Haselnuss')).toEqual({ nutty: 1 });
    expect(noteFlavour('Würzig')).toEqual({ spice: 1 });
    expect(noteFlavour('rote Beeren')).toEqual({ fruity: 1 });
    expect(noteFlavour('Bergamotte')).toEqual({ citrus: 0.7, floral: 0.7 });
    expect(noteFlavour('Nougat')).toEqual({ nutty: 1, chocolate: 0.5 });
    expect(noteFlavour('Rosine')).toEqual({ fruity: 0.7, caramel: 0.5 }); // not "rose"
    expect(noteFlavour('Tropical fruit')).toEqual({ fruity: 1 });
    // German compounds and spellings from the Munich CSV
    expect(noteFlavour('Vollmilchschokolade')).toEqual({ chocolate: 1, caramel: 0.3 });
    expect(noteFlavour('Gewürze')).toEqual({ spice: 1 });
    expect(noteFlavour('Haselnuesse')).toEqual({ nutty: 1 });
    expect(noteFlavour('Blutorange')).toEqual({ citrus: 1, fruity: 0.3 }); // not "blute"
    expect(noteFlavour('Steinobst')).toEqual({ fruity: 1 });
    expect(noteFlavour('vollmundig')).toBeNull();
  });

  it('builds a vector scaled to the strongest dimension and reports unmapped notes', () => {
    const { vector, unmapped } = flavourFromNotes(['Blaubeere', 'Jasmin', 'Dunkle Schokolade', 'Erdbeere', 'vollmundig']);
    expect(vector).toMatchObject({ fruity: 1, floral: 0.5, chocolate: 0.5, nutty: 0, citrus: 0 });
    expect(unmapped).toEqual(['vollmundig']);
    expect(Object.values(flavourFromNotes([]).vector).every((v) => v === 0)).toBe(true);
  });

  it('has a mapping for every user flavour tag', () => {
    expect(Object.keys(TAG_FLAVOUR).sort()).toEqual([...FLAVOUR_TAGS].sort());
  });
});

describe('sensory priors', () => {
  it('light washed Ethiopian is brighter and lighter than a dark Brazilian espresso', () => {
    const light = sensoryPrior(product({ roastLevel: 1, process: 'washed', originCountries: ['ET'], roastFor: ['filter'], tastingNotes: ['Zitrone', 'Jasmin'] }));
    const dark = sensoryPrior(product({ roastLevel: 3, process: 'natural', originCountries: ['BR'], roastFor: ['espresso'], tastingNotes: ['Schokolade', 'vollmundig'] }));
    expect(light.acidity).toBeGreaterThan(0.8);
    expect(dark.acidity).toBeLessThan(0.3);
    expect(dark.body).toBeGreaterThan(light.body);
    expect(dark.bitterness).toBeGreaterThan(light.bitterness);
  });

  it('stays at 0.5 without information and inside [0, 1] always', () => {
    expect(sensoryPrior(product())).toEqual({ acidity: 0.5, sweetness: 0.5, body: 0.5, bitterness: 0.5 });
    const extreme = sensoryPrior(product({ roastLevel: 1, process: 'washed', originCountries: ['KE'], roastFor: ['filter'], tastingNotes: ['Zitrone', 'lebhafte Säure', 'bright', 'juicy', 'saftig'] }));
    expect(Object.values(extreme).every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});

describe('origin and decaf', () => {
  it('maps countries to regions; several make a blend', () => {
    expect(originRegion(['ET'])).toBe('eastAfrica');
    expect(originRegion(['gt'])).toBe('centralAmerica');
    expect(originRegion(['BR', 'CO'])).toBe('blend');
    expect(originRegion([])).toBeNull();
    expect(originRegion(['DE'])).toBeNull();
  });

  it('detects decaf from name or notes', () => {
    expect(isDecaf(product({ name: 'DECAF DE CAÑA, COLOMBIA, SUGARCANE DECAF' }))).toBe(true);
    expect(isDecaf(product({ name: 'Kolumbien entkoffeiniert' }))).toBe(true);
    expect(isDecaf(product({ name: 'Decaffeinato' }))).toBe(true);
    expect(isDecaf(product({ name: 'Ethiopia Guji' }))).toBe(false);
  });

  it('bundles the features of a catalog row', () => {
    expect(catalogFeatures(product({ originCountries: ['KE'], tastingNotes: ['Johannisbeere'] }))).toMatchObject({ originRegion: 'eastAfrica', decaf: false, flavour: { fruity: 1 } });
  });
});
