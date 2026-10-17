import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fitContextModel, freshnessAt, freshnessBasis, FRESHNESS_KNOTS, solveSpd } from './context';
import { seededRng } from './ports';
import type { Rating } from './rating';

const NOW = Date.parse('2026-10-16T08:00:00+02:00');

describe('solveSpd', () => {
  it('solves a small SPD system', () => {
    const x = solveSpd(
      [
        [4, 1, 0],
        [1, 3, 1],
        [0, 1, 2],
      ],
      [1, 2, 3],
    );
    expect(4 * x[0]! + x[1]!).toBeCloseTo(1, 9);
    expect(x[0]! + 3 * x[1]! + x[2]!).toBeCloseTo(2, 9);
    expect(x[1]! + 2 * x[2]!).toBeCloseTo(3, 9);
  });
});

describe('freshness basis', () => {
  it('hat functions sum to 1 and interpolate between knots', () => {
    expect(freshnessBasis(0)).toEqual([[0, 1]]);
    expect(freshnessBasis(14)).toEqual([
      [1, 0.5],
      [2, 0.5],
    ]);
    expect(freshnessBasis(100)).toEqual([[FRESHNESS_KNOTS.length - 1, 1]]);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 200, noNaN: true }), (d) => {
        expect(freshnessBasis(d).reduce((s, [, v]) => s + v, 0)).toBeCloseTo(1, 9);
      }),
    );
    const curve = FRESHNESS_KNOTS.map((day, k) => ({ day, effect: k }));
    expect(freshnessAt(curve, 14)).toBeCloseTo(1.5, 9);
  });
});

/** Synthetic history from a known additive model (deterministic). */
function synth(n: number, seed = 7): Rating[] {
  const rng = seededRng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
  const PRODUCT = { good: 0.4, bad: -0.4, ok: 0 } as const;
  const METHOD = { aeropress: 0.1, frenchPress: -0.3, v60: 0.1 } as const;
  const MEAL = { sweet: 0.3, none: 0, savory: -0.1 } as const;
  const fresh = (d: number) => (d < 7 ? -0.1 : d < 28 ? 0.2 : -0.3); // peak 1–4 weeks
  const out: Rating[] = [];
  for (let i = 0; i < n; i++) {
    const product = pick(Object.keys(PRODUCT)) as keyof typeof PRODUCT;
    const method = pick(Object.keys(METHOD)) as keyof typeof METHOD;
    const meal = pick(Object.keys(MEAL)) as keyof typeof MEAL;
    const days = Math.floor(rng() * 60);
    const noise = (rng() - 0.5) * 0.3;
    const p = 0.1 + PRODUCT[product] + METHOD[method] + MEAL[meal] + fresh(days) + noise;
    const stars = Math.min(5, Math.max(0.5, Math.round((3 + 2 * p) * 2) / 2));
    out.push({
      level: 'stars',
      overall: stars,
      source: 'home',
      productId: product,
      bagId: `bag-${product}`,
      brew: { method },
      meal: { type: meal },
      timeOfDay: pick(['morning', 'afternoon'] as const),
      derived: { daysSinceRoast: days, daysSinceOpen: null, pastExpiry: false },
      ratedAt: new Date(NOW - Math.floor(rng() * 30) * 86_400_000).toISOString(),
      excluded: false,
      deletedAt: null,
    } as unknown as Rating);
  }
  return out;
}

const effect = (m: NonNullable<ReturnType<typeof fitContextModel>>, group: string, level: string) =>
  m.effects.find((e) => e.group === group && e.level === level)?.effect ?? NaN;

describe('fitContextModel', () => {
  it('returns null without usable cups', () => {
    expect(fitContextModel([], { nowMs: NOW })).toBeNull();
  });

  it('recovers bean, method, meal and freshness effects from a known model', () => {
    const m = fitContextModel(synth(600), { nowMs: NOW })!;
    expect(m.n).toBe(600);
    // bean scores separate the products in the right order and size
    expect(m.beanScores.good! - m.beanScores.bad!).toBeGreaterThan(0.6);
    expect(m.beanScores.good! - m.beanScores.bad!).toBeLessThan(1.0);
    expect(m.beanScores.ok!).toBeGreaterThan(m.beanScores.bad!);
    expect(m.beanScores.ok!).toBeLessThan(m.beanScores.good!);
    // context effects, relative within their group
    expect(effect(m, 'meal', 'sweet') - effect(m, 'meal', 'none')).toBeGreaterThan(0.2);
    expect(effect(m, 'method', 'frenchPress') - effect(m, 'method', 'aeropress')).toBeLessThan(-0.25);
    // freshness: the 7–21 day knots beat the 63+ knot
    const curve = m.freshness!;
    expect(freshnessAt(curve, 14)).toBeGreaterThan(freshnessAt(curve, 60));
    expect(m.effects.find((e) => e.group === 'meal' && e.level === 'sweet')!.n).toBeGreaterThan(100);
  });

  it('café cups with an unknown bean leave bean scores alone but inform meal effects', () => {
    const home = synth(300);
    const base = fitContextModel(home, { nowMs: NOW })!;
    const cafe = Array.from({ length: 80 }, (_, i) => ({
      level: 'stars',
      overall: i % 2 ? 5 : 1,
      source: 'cafe',
      productId: null,
      venueId: 'vits',
      cafe: { drink: 'cappuccino', milk: 'dairy', size: 'regular' },
      meal: { type: i % 2 ? 'sweet' : 'savory' },
      timeOfDay: 'afternoon',
      ratedAt: new Date(NOW - 86_400_000).toISOString(),
      excluded: false,
      deletedAt: null,
    })) as unknown as Rating[];
    const both = fitContextModel([...home, ...cafe], { nowMs: NOW })!;
    expect(Object.keys(both.beanScores).sort()).toEqual(['bad', 'good', 'ok']);
    expect(Math.abs(both.beanScores.good! - both.beanScores.bad! - (base.beanScores.good! - base.beanScores.bad!))).toBeLessThan(0.1);
    expect(effect(both, 'meal', 'sweet') - effect(both, 'meal', 'savory')).toBeGreaterThan(
      effect(base, 'meal', 'sweet') - effect(base, 'meal', 'savory'),
    );
    expect(effect(both, 'venue', 'vits')).toBeDefined();
    expect(effect(both, 'drink', 'cappuccino')).toBeDefined();
  });

  it('a level seen once is shrunk towards no effect', () => {
    const rs = synth(200);
    rs.push({ ...rs[0]!, productId: 'once', overall: 5 } as Rating);
    const m = fitContextModel(rs, { nowMs: NOW })!;
    expect(Math.abs(effect(m, 'product', 'once'))).toBeLessThan(0.4);
  });

  it('ignores excluded and deleted cups', () => {
    const rs = synth(50);
    const m1 = fitContextModel(rs, { nowMs: NOW })!;
    const m2 = fitContextModel(
      [...rs, { ...rs[0]!, overall: 0.5, excluded: true } as Rating, { ...rs[1]!, deletedAt: 'x' } as Rating],
      { nowMs: NOW },
    )!;
    expect(m2.n).toBe(m1.n);
    expect(m2.mu).toBeCloseTo(m1.mu, 12);
  });

  it('runs in milliseconds for thousands of ratings', () => {
    // core has no DOM/Node types; the test runner has `performance`
    const perf = (globalThis as unknown as { performance: { now(): number } }).performance;
    const rs = synth(3000);
    const t0 = perf.now();
    fitContextModel(rs, { nowMs: NOW });
    expect(perf.now() - t0).toBeLessThan(500);
  });
});
