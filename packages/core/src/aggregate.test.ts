import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { aggregate, recencyWeight, toDisplayScore } from './aggregate';
import { preferenceOf, starsToP } from './preference';
import { makeRating } from './testing';

const NOW = Date.parse('2026-10-16T12:00:00+02:00');

describe('preference mapping (fixed)', () => {
  it('maps levels to p and c', () => {
    expect(preferenceOf({ level: 'swipe', swipe: 'more' })).toEqual({ p: 0.5, c: 0.5 });
    expect(preferenceOf({ level: 'swipe', swipe: 'less' })).toEqual({ p: -0.5, c: 0.5 });
    expect(preferenceOf({ level: 'stars', overall: 5 })).toEqual({ p: 1, c: 1 });
    expect(preferenceOf({ level: 'advanced', overall: 3, wouldBuyAgain: true })).toEqual({ p: 0.1, c: 1.2 });
    expect(preferenceOf({ level: 'stars', overall: 0.5 })!.p).toBe(-1);
  });

  it('is monotonic in stars and bounded', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), fc.integer({ min: 1, max: 10 }), (a, b) => {
        const [pa, pb] = [starsToP(a / 2, null), starsToP(b / 2, null)];
        if (a <= b) expect(pa).toBeLessThanOrEqual(pb);
        expect(Math.abs(pa)).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('personal centring clips z to ±2', () => {
    expect(starsToP(4, { mean: 4, sd: 0.5 })).toBe(0);
    expect(starsToP(5, { mean: 4, sd: 0.5 })).toBe(1);
    expect(starsToP(3.5, { mean: 4, sd: 0.5 })).toBe(-0.5);
  });
});

describe('recencyWeight', () => {
  it('halves every half-life', () => {
    expect(recencyWeight('2026-10-16T12:00:00+02:00', NOW, 60)).toBe(1);
    expect(recencyWeight('2026-08-17T12:00:00+02:00', NOW, 60)).toBeCloseTo(0.5, 6);
    expect(recencyWeight('2026-10-20T12:00:00+02:00', NOW, 60)).toBe(1);
  });
});

describe('aggregate', () => {
  it('mixes levels into one score', () => {
    const rs = [
      makeRating({ level: 'swipe', swipe: 'more' }),
      makeRating({ level: 'stars', overall: 5 }),
      makeRating({ level: 'advanced', overall: 4, profile: { sweetness: 2, acidity: 4 }, wish: { sweetness: 'more' } }),
    ];
    const s = aggregate(rs, { nowMs: NOW });
    expect(s.byLevel).toEqual({ swipe: 1, stars: 1, advanced: 1 });
    // (0.5·0.5 + 1·1 + 1.2·0.5) / 2.7
    expect(s.score).toBeCloseTo(1.85 / 2.7, 9);
    expect(s.stars).toMatchObject({ n: 2, mean: 4.5, median: 4.5 });
    expect(s.profile).toEqual({ sweetness: 2, acidity: 4 });
    expect(s.wishes.sweetness).toEqual({ more: 1, justRight: 0, less: 0 });
    expect(s.robustMethod).toBe('trimmed');
    expect(toDisplayScore(s.score!)).toBe(69);
  });

  it('excludes manual and automatic outliers, with a toggle for automatic ones', () => {
    const rs = [4, 4.5, 4, 3.5, 4.5, 3.5, 0.5].map((overall, i) =>
      makeRating({ id: `x${i}`, overall, ratedAt: `2026-10-0${i + 1}T08:00:00+02:00` }),
    );
    rs.push(makeRating({ id: 'manual', overall: 5, excluded: true }));
    const s = aggregate(rs, { nowMs: NOW });
    expect(s.excluded.map((e) => e.ratingId).sort()).toEqual(['manual', 'x6']);
    expect(s.nCounted).toBe(6);
    expect(s.stars!.mean).toBeCloseTo(4, 9);
    const incl = aggregate(rs, { nowMs: NOW, includeOutliers: true });
    expect(incl.nCounted).toBe(7);
    expect(incl.excluded.map((e) => e.ratingId)).toEqual(['manual']);
  });

  it('recency weighting follows recent taste', () => {
    const rs = [
      makeRating({ overall: 5, ratedAt: '2025-10-16T08:00:00+02:00' }),
      makeRating({ overall: 2, ratedAt: '2026-10-15T08:00:00+02:00' }),
    ];
    const s = aggregate(rs, { nowMs: NOW });
    expect(s.score).toBeCloseTo(0.25, 9);
    expect(s.currentScore!).toBeLessThan(-0.45);
  });

  it('ignores deleted ratings and keeps scores in [-1, 1]', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 10 }), { maxLength: 30 }), (vals) => {
        const rs = vals.map((v, i) => makeRating({ overall: v / 2, deletedAt: i % 7 === 3 ? '2026-10-16T00:00:00+02:00' : null }));
        const s = aggregate(rs, { nowMs: NOW });
        expect(s.n).toBe(rs.filter((r) => !r.deletedAt).length);
        if (s.score !== null) expect(Math.abs(s.score)).toBeLessThanOrEqual(1);
      }),
    );
  });
});
