import { describe, expect, it } from 'vitest';
import { Catalog, catalogJsonSchema, EMPTY_CATALOG } from './catalog';
import { CATALOG_FIXTURE } from './catalog.fixture';

const cat = Catalog.parse(CATALOG_FIXTURE);

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
