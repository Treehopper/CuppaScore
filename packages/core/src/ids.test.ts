import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { UUID_RE, uuidv7, uuidv7Generator } from './ids';
import { fixedClock, seededRng } from './ports';

describe('uuidv7', () => {
  it('has version 7 and RFC variant', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 48 - 1 }), fc.integer(), (ms, seed) => {
        const id = uuidv7(ms, seededRng(seed));
        expect(id).toMatch(UUID_RE);
        expect(id[14]).toBe('7');
        expect('89ab').toContain(id[19]);
        expect(parseInt(id.slice(0, 8) + id.slice(9, 13), 16)).toBe(ms);
      }),
    );
  });

  it('generator is monotonic within one millisecond', () => {
    const gen = uuidv7Generator(fixedClock('2026-10-16T08:00:00Z'), seededRng(1));
    const ids = Array.from({ length: 50 }, () => gen.next());
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(50);
  });
});
