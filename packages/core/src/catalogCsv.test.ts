import { describe, expect, it } from 'vitest';
import { CATALOG_CSV_COLUMNS, foldText, isCatalogBlend, parseCatalogCsv, parseCsv, searchCatalog, type CatalogProduct } from './catalogCsv';

const HEADER = CATALOG_CSV_COLUMNS.join(',');
const row = (o: Partial<Record<(typeof CATALOG_CSV_COLUMNS)[number], string>> = {}) =>
  CATALOG_CSV_COLUMNS.map(
    (c) =>
      o[c] ??
      {
        id: 'vits-ethiopia-guji',
        roaster: 'Vits der Kaffee',
        roaster_city: 'München',
        name: 'Ethiopia Guji',
        origin_countries: 'ET',
        region: 'Guji',
        process: 'natural',
        varieties: 'Heirloom',
        roast_level: '1',
        roast_for: 'filter;omni',
        tasting_notes: 'Blaubeere;Jasmin',
        weight_g: '250',
        price_eur: '16.90',
        url: 'https://vits.de/guji',
        available: 'true',
        updated_at: '2026-10-17',
      }[c],
  ).join(',');

const parse = (...rows: string[]) => parseCatalogCsv([HEADER, ...rows].join('\r\n'), 'munich');

describe('parseCsv (RFC 4180)', () => {
  it('handles quotes, escaped quotes, embedded newlines, CRLF, BOM and blank lines', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n\n"multi\nline",\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['multi\nline', ''],
    ]);
    expect(parseCsv('a,b')).toEqual([['a', 'b']]);
    expect(parseCsv('')).toEqual([]);
  });
});

describe('parseCatalogCsv', () => {
  it('maps a full row', () => {
    const res = parse(row());
    expect(res).toMatchObject({ ok: true, skipped: [] });
    const p = res.ok && res.products[0]!;
    expect(p).toEqual({
      id: 'vits-ethiopia-guji',
      roaster: 'Vits der Kaffee',
      roasterCity: 'München',
      name: 'Ethiopia Guji',
      originCountries: ['ET'],
      region: 'Guji',
      process: 'natural',
      varietals: ['Heirloom'],
      roastLevel: 1,
      roastFor: ['filter', 'omni'],
      tastingNotes: ['Blaubeere', 'Jasmin'],
      weightG: 250,
      priceEur: 16.9,
      url: 'https://vits.de/guji',
      available: true,
      updatedAt: '2026-10-17',
      source: 'munich',
    } satisfies CatalogProduct);
  });

  it('accepts empty optional cells (e.g. no price for Dallmayr)', () => {
    const res = parse(
      row({ id: 'dallmayr-prodomo', roaster: 'Dallmayr', roaster_city: '', origin_countries: '', region: '', process: '', varieties: '', roast_level: '', roast_for: '', tasting_notes: '', weight_g: '', price_eur: '', url: '' }),
    );
    expect(res.ok && res.products[0]).toMatchObject({ priceEur: null, process: null, roastLevel: null, originCountries: [], url: null, roastFor: [] });
  });

  it('lists blends with all origins, quoted names with commas', () => {
    const res = parse(row({ id: 'mvm-bomba', name: '"BOMBA DE FRUTA, GUATEMALA"', origin_countries: 'br;co;et' }));
    const p = res.ok ? res.products[0]! : undefined;
    expect(p?.name).toBe('BOMBA DE FRUTA, GUATEMALA');
    expect(p?.originCountries).toEqual(['BR', 'CO', 'ET']);
    expect(isCatalogBlend(p!)).toBe(true);
  });

  it('skips invalid rows with reasons and keeps the rest', () => {
    const res = parse(
      row({ id: 'ok-1' }),
      row({ id: 'bad-roast', roast_level: '5' }),
      row({ id: 'bad-many', process: 'wet', available: 'maybe', updated_at: '17.10.2026' }),
      row({ id: '', roaster: '' }),
      row({ id: 'ok-1' }),
      row({ id: 'Bad Id' }),
    );
    expect(res.ok && res.products.map((p) => p.id)).toEqual(['ok-1']);
    expect(res.ok && res.skipped).toEqual([
      { line: 3, id: 'bad-roast', field: 'roast_level', code: 'too_big' },
      { line: 4, id: 'bad-many', field: 'process', code: 'invalid_value' },
      { line: 4, id: 'bad-many', field: 'available', code: 'invalid_type' },
      { line: 4, id: 'bad-many', field: 'updated_at', code: 'invalid_format' },
      { line: 5, field: 'id', code: 'required' },
      { line: 5, field: 'roaster', code: 'required' },
      { line: 6, id: 'ok-1', field: 'id', code: 'duplicate' },
      { line: 7, id: 'Bad Id', field: 'id', code: 'invalid_format' },
    ]);
  });

  it('rejects files without the required header or rows', () => {
    expect(parseCatalogCsv('', 'file')).toEqual({ ok: false, problem: { code: 'CATALOG_CSV_EMPTY' } });
    expect(parseCatalogCsv('id,roaster,name\nx,y,z', 'file')).toMatchObject({ ok: false, problem: { code: 'CATALOG_CSV_HEADER', missing: expect.arrayContaining(['updated_at']) } });
  });
});

describe('searchCatalog', () => {
  const res = parse(
    row({ id: 'vits-ethiopia-guji', name: 'Ethiopia Guji Natural' }),
    row({ id: 'vits-kolumbien-huila', name: 'Kolumbien Huila', origin_countries: 'CO', region: 'Huila', process: 'washed', tasting_notes: 'Haselnuss;Karamell' }),
    row({ id: 'wildkaffee-decaf', roaster: 'Wildkaffee', name: 'Café Descafeinado', origin_countries: 'BR', region: '', tasting_notes: '' }),
    row({ id: 'vits-kenya-old', name: 'Kenya Nyeri', origin_countries: 'KE', region: 'Nyeri', available: 'false' }),
  );
  const all = res.ok ? res.products : [];
  const ids = (text: string, extra?: (p: CatalogProduct) => string) => searchCatalog(all, { text }, extra).map((c) => c.id);

  it('folds case, accents and umlauts', () => {
    expect(foldText('Café Größe')).toBe('cafe grosse');
  });

  it('matches every word by prefix across roaster, name, origin and notes', () => {
    expect(ids('guji')).toEqual(['vits-ethiopia-guji']);
    expect(ids('vits kolum')).toEqual(['vits-kolumbien-huila']);
    expect(ids('haselnuss')).toEqual(['vits-kolumbien-huila']);
    expect(ids('cafe')).toEqual(['wildkaffee-decaf']);
    expect(ids('br')).toEqual(['wildkaffee-decaf']);
    expect(ids('vits nope')).toEqual([]);
  });

  it('uses localised origin names supplied by the caller', () => {
    expect(ids('brasilien', (p) => (p.originCountries.includes('BR') ? 'Brasilien' : ''))).toEqual(['wildkaffee-decaf']);
  });

  it('lists sold-out lots after available ones, or hides them', () => {
    expect(ids('vits')).toEqual(['vits-ethiopia-guji', 'vits-kolumbien-huila', 'vits-kenya-old']);
    expect(searchCatalog(all, { text: 'kenya', includeUnavailable: false })).toEqual([]);
    expect(searchCatalog(all, { limit: 2 })).toHaveLength(2);
  });
});
