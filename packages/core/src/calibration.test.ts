import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeCalibration, MIN_STAR_SD } from './calibration';
import { FIXED_CALIBRATION, preferenceOf, starsToP } from './preference';
import type { Rating } from './rating';

const NOW = Date.parse('2026-10-16T08:00:00+02:00');
const DAY = 86_400_000;

function cup(overall: number, daysAgo = 0, extra: Partial<Rating> = {}): Rating {
  return {
    level: 'stars',
    overall,
    ratedAt: new Date(NOW - daysAgo * DAY).toISOString(),
    excluded: false,
    deletedAt: null,
    ...extra,
  } as Rating;
}

describe('computeCalibration', () => {
  it('fixed mapping below 10 star ratings (swipes do not count)', () => {
    const rs = [...Array.from({ length: 9 }, () => cup(4)), ...Array.from({ length: 5 }, () => cup(0, 0, { level: 'swipe', overall: undefined, swipe: 'more' }))];
    expect(computeCalibration(rs, { nowMs: NOW })).toEqual(FIXED_CALIBRATION);
  });

  it('a habitual 4-star rater and a strict 3-star rater both read "above my usual" as positive', () => {
    const generous = computeCalibration([3.5, 4, 4, 4, 4.5, 4, 4, 3.5, 4.5, 4].map((s) => cup(s)), { nowMs: NOW });
    const strict = computeCalibration([2.5, 3, 3, 3, 3.5, 3, 3, 2.5, 3.5, 3].map((s) => cup(s)), { nowMs: NOW });
    expect(generous.stars!.mean).toBeCloseTo(4, 5);
    expect(strict.stars!.mean).toBeCloseTo(3, 5);
    expect(starsToP(4, generous.stars)).toBeCloseTo(0, 5);
    expect(starsToP(4.5, generous.stars)).toBeGreaterThan(0);
    expect(starsToP(3.5, strict.stars)).toBeGreaterThan(0);
    // the same 4 stars mean different things
    expect(starsToP(4, strict.stars)).toBeGreaterThan(starsToP(4, generous.stars));
    // the fixed mapping would call every generous 4 ★ a clear positive
    expect(starsToP(4, null)).toBe(0.5);
  });

  it('weights recent ratings more (taste drift)', () => {
    const rs = [...Array.from({ length: 10 }, () => cup(2, 365)), ...Array.from({ length: 10 }, () => cup(4, 1))];
    expect(computeCalibration(rs, { nowMs: NOW, halfLifeDays: 60 }).stars!.mean).toBeGreaterThan(3.9);
  });

  it('ignores excluded and deleted cups', () => {
    const rs = [...Array.from({ length: 10 }, () => cup(3)), cup(5, 0, { excluded: true }), cup(5, 0, { deletedAt: '2026-10-16T08:00:00+02:00' })];
    expect(computeCalibration(rs, { nowMs: NOW }).stars!.mean).toBe(3);
  });

  it('floors the spread so one half star does not swing the score fully', () => {
    const cal = computeCalibration(Array.from({ length: 12 }, () => cup(4)), { nowMs: NOW });
    expect(cal.stars!.sd).toBe(MIN_STAR_SD);
    expect(starsToP(4.5, cal.stars)).toBeCloseTo(0.5, 5);
  });

  it('swipes mean what a typical good / bad cup means for you', () => {
    const cal = computeCalibration([1, 2, 3, 3, 3, 3, 4, 4, 5, 5].map((s) => cup(s)), { nowMs: NOW });
    const ps = [1, 2, 3, 3, 3, 3, 4, 4, 5, 5].map((s) => starsToP(s, cal.stars));
    const pos = ps.filter((p) => p > 0).sort((a, b) => a - b);
    expect(cal.swipe.plus).toBeCloseTo((pos[1]! + pos[2]!) / 2, 5);
    expect(preferenceOf({ level: 'swipe', swipe: 'more' }, cal)!.p).toBeCloseTo(cal.swipe.plus, 5);
    expect(preferenceOf({ level: 'swipe', swipe: 'less' }, cal)!.p).toBeCloseTo(-cal.swipe.minus, 5);
  });

  it('keeps the default swipe magnitude when one side has no cups', () => {
    const cal = computeCalibration(Array.from({ length: 10 }, (_, i) => cup(i < 5 ? 4 : 4.5)), { nowMs: NOW });
    expect(cal.swipe.plus).toBeGreaterThan(0);
    expect(cal.swipe.minus).toBeGreaterThan(0);
    const allSame = computeCalibration(Array.from({ length: 10 }, () => cup(4)), { nowMs: NOW });
    expect(allSame.swipe).toEqual(FIXED_CALIBRATION.swipe);
  });

  it('property: p stays in [−1, 1] and is monotone in stars', () => {
    const star = fc.integer({ min: 1, max: 10 }).map((n) => n / 2);
    fc.assert(
      fc.property(fc.array(fc.tuple(star, fc.integer({ min: 0, max: 400 })), { minLength: 10, maxLength: 60 }), (xs) => {
        const cal = computeCalibration(xs.map(([s, d]) => cup(s, d)), { nowMs: NOW });
        let prev = -Infinity;
        for (let s = 0.5; s <= 5; s += 0.5) {
          const p = starsToP(s, cal.stars);
          expect(p).toBeGreaterThanOrEqual(-1);
          expect(p).toBeLessThanOrEqual(1);
          expect(p).toBeGreaterThanOrEqual(prev);
          prev = p;
        }
        expect(cal.swipe.plus).toBeGreaterThan(0);
        expect(cal.swipe.minus).toBeGreaterThan(0);
      }),
    );
  });
});
