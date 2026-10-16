import { describe, expect, it } from 'vitest';
import { migrateBundle, toCsv } from './bundle';
import { makeRating } from './testing';

describe('bundle', () => {
  const base = { app: 'cuplog', schemaVersion: 1, exportedAt: '2026-10-16T08:00:00+02:00', products: [], bags: [], venues: [], settings: null };

  it('accepts current bundles', () => {
    const res = migrateBundle({ ...base, ratings: [makeRating()] });
    expect(res.ok).toBe(true);
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
