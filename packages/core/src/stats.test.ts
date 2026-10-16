import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mad, mean, median, stdDev, trimmedMean, weightedMean } from './stats';

const nums = fc.array(fc.double({ min: -1e3, max: 1e3, noNaN: true }), { minLength: 1, maxLength: 60 });

describe('stats primitives', () => {
  it('known values', () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(median([5, 1, 3, 2])).toBe(2.5);
    expect(trimmedMean([0, 1, 1, 1, 1, 1, 1, 1, 1, 100])).toBe(1);
    expect(mad([1, 1, 2, 2, 4, 6, 9])).toBe(1);
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(weightedMean([1, 3], [3, 1])).toBe(1.5);
    expect(mean([])).toBeNull();
    expect(weightedMean([1], [0])).toBeNull();
  });

  it('central tendencies lie within [min, max]', () => {
    fc.assert(
      fc.property(nums, (xs) => {
        const lo = Math.min(...xs) - 1e-9;
        const hi = Math.max(...xs) + 1e-9;
        for (const v of [mean(xs)!, median(xs)!, trimmedMean(xs)!]) {
          expect(v).toBeGreaterThanOrEqual(lo);
          expect(v).toBeLessThanOrEqual(hi);
        }
      }),
    );
  });

  it('median and MAD are shift-equivariant / invariant', () => {
    fc.assert(
      fc.property(nums, fc.integer({ min: -100, max: 100 }), (xs, k) => {
        const shifted = xs.map((x) => x + k);
        expect(median(shifted)!).toBeCloseTo(median(xs)! + k, 6);
        expect(mad(shifted)!).toBeCloseTo(mad(xs)!, 6);
      }),
    );
  });
});
