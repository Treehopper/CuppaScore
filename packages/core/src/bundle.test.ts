import { describe, expect, it } from 'vitest';
import { migrateBundle, toCsv } from './bundle';
import { makeProduct, makeRating } from './testing';

describe('bundle', () => {
  const base = { app: 'cuplog', schemaVersion: 2, exportedAt: '2026-10-16T08:00:00+02:00', products: [], bags: [], venues: [], settings: null };

  it('accepts current bundles', () => {
    const res = migrateBundle({ ...base, ratings: [makeRating()] });
    expect(res.ok).toBe(true);
  });

  it('migrates v1 bundles: roast level 1–5 becomes 1–3', () => {
    const p = (roastLevel: number | null) => ({ ...makeProduct(), roastLevel });
    const res = migrateBundle({ ...base, schemaVersion: 1, ratings: [], products: [p(1), p(2), p(3), p(4), p(5), p(null)] });
    expect(res.ok && res.bundle.products.map((x) => x.roastLevel)).toEqual([1, 1, 2, 3, 3, null]);
    expect(res.ok && res.bundle.schemaVersion).toBe(2);
    expect(migrateBundle({ ...base, ratings: [], products: [p(4)] })).toMatchObject({ ok: false });
  });

  it('rejects future versions and invalid records', () => {
    expect(migrateBundle({ ...base, schemaVersion: 99, ratings: [] })).toMatchObject({ ok: false, problem: { code: 'UNSUPPORTED_SCHEMA_VERSION' } });
    expect(migrateBundle(null)).toMatchObject({ ok: false });
    const bad = migrateBundle({ ...base, ratings: [{ ...makeRating(), overall: 7 }] });
    expect(bad).toMatchObject({ ok: false, problem: { code: 'IMPORT_INVALID' } });
  });

  it('writes CSV with quoting and formula guard', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', null, 4.5, true, '=SUM(A1)']])).toBe('a,"b,c","say ""hi""",,4.5,true,\'=SUM(A1)\r\n');
    expect(toCsv([[-1]])).toBe('-1\r\n');
  });
});
