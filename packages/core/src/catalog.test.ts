import { describe, expect, it } from 'vitest';
import { Catalog, catalogJsonSchema, EMPTY_CATALOG, foldText, searchCatalog } from './catalog';
import { CATALOG_FIXTURE } from './catalog.fixture';

const cat = Catalog.parse(CATALOG_FIXTURE);
const ids = (q: Parameters<typeof searchCatalog>[1]) => searchCatalog(cat, q).map((c) => c.id);

describe('catalog schema', () => {
  it('parses the README example shape with defaults', () => {
    expect(cat.coffees[1]!.isBlend).toBe(false);
    expect(cat.sellers[1]!.addresses).toEqual([]);
    expect(Catalog.parse(EMPTY_CATALOG).coffees).toEqual([]);
  });

  it('rejects bad files', () => {
    expect(Catalog.safeParse({ ...CATALOG_FIXTURE, coffees: [{ id: 'Bad Id', sellerIds: [] }] }).success).toBe(false);
    expect(Catalog.safeParse({ version: '1' }).success).toBe(false);
  });

  it('exports a JSON Schema', () => {
    const s = catalogJsonSchema();
    expect(s.$schema).toContain('2020-12');
    expect((s.properties as Record<string, unknown>).coffees).toBeDefined();
  });
});

describe('searchCatalog', () => {
  it('folds case, accents and umlauts', () => {
    expect(foldText('Café Größe')).toBe('cafe grosse');
  });

  it('matches every word by prefix across fields, name hits first', () => {
    expect(ids({ text: 'guji' })).toEqual(['vits-ethiopia-guji-natural']);
    expect(ids({ text: 'vits kolum' })).toEqual(['vits-kolumbien-huila']);
    expect(ids({ text: 'haselnuss' })).toEqual(['vits-kolumbien-huila']);
    expect(ids({ text: 'descafeinado' })).toEqual(['wildkaffee-decaf-brasil']);
    expect(ids({ text: 'cafe' })).toEqual(['wildkaffee-decaf-brasil']);
    expect(ids({ text: 'vits nope' })).toEqual([]);
    // "natural" is in a name (strong) and a process (weak)
    expect(ids({ text: 'natural' })).toEqual(['vits-ethiopia-guji-natural', 'wildkaffee-decaf-brasil']);
  });

  it('filters', () => {
    expect(ids({ roastFor: ['espresso'] })).toEqual(['vits-kolumbien-huila', 'wildkaffee-decaf-brasil']);
    expect(ids({ decaf: true })).toEqual(['wildkaffee-decaf-brasil']);
    expect(ids({ sellerId: 'kaffeekontor', maxPricePerKg: 40 })).toEqual(['wildkaffee-decaf-brasil']);
    expect(ids({ process: ['washed'] })).toEqual(['vits-kolumbien-huila']);
    expect(ids({ barcode: '4260123456789' })).toEqual(['vits-ethiopia-guji-natural']);
  });

  it('hides unavailable coffees unless asked', () => {
    expect(ids({ text: 'kenya' })).toEqual([]);
    expect(ids({ text: 'kenya', includeUnavailable: true })).toEqual(['vits-kenya-old']);
  });

  it('empty query lists available coffees by roaster and name, with a limit', () => {
    expect(ids({})).toEqual(['vits-ethiopia-guji-natural', 'vits-kolumbien-huila', 'wildkaffee-decaf-brasil']);
    expect(ids({ limit: 1 })).toHaveLength(1);
  });
});
