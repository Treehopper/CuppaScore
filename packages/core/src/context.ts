import { recencyWeight } from './aggregate';
import { FIXED_CALIBRATION, preferenceOf, type Calibration } from './preference';
import type { Rating } from './rating';
import { DEFAULT_CONFIDENCE, type ConfidenceWeights } from './settings';

/**
 * Context-adjusted scores (README §5.4): a weighted ridge regression
 *
 *   p ≈ μ + product + method|drink + meal + timeOfDay + venue + freshness(daysSinceRoast)
 *
 * weighted by c·w. Ridge shrinks every level towards 0 (so `meal = unspecified`, typical for
 * swipes, is a zero-centred level of its own); only μ is unpenalised.
 */

export type ContextGroup = 'product' | 'method' | 'drink' | 'meal' | 'timeOfDay' | 'venue';

/** Knots of the piecewise-linear freshness curve, days since roast (buckets 0–7, 8–21, 22–42, 43+). */
export const FRESHNESS_KNOTS = [0, 7, 21, 42, 63] as const;

export interface ContextOptions {
  nowMs: number;
  halfLifeDays?: number;
  calibration?: Calibration;
  confidence?: ConfidenceWeights;
  /** ridge strength; larger = more shrinkage towards "no effect" */
  lambda?: number;
}

export interface Effect {
  group: ContextGroup;
  level: string;
  /** additive effect on p (−1 … +1 scale) */
  effect: number;
  /** cups with this level */
  n: number;
}

export interface ContextModel {
  /** baseline */
  mu: number;
  /** cups used */
  n: number;
  effects: Effect[];
  /** context-neutral bean score per productId: μ + product effect */
  beanScores: Record<string, number>;
  /** effect at each knot of FRESHNESS_KNOTS (null without home cups that know the roast date) */
  freshness: { day: number; effect: number }[] | null;
}

interface Row {
  p: number;
  w: number;
  /** column index → value */
  x: Map<number, number>;
}

/** Hat basis: weights of the two knots around `days`. */
export function freshnessBasis(days: number): [number, number][] {
  const K = FRESHNESS_KNOTS;
  if (days <= K[0]) return [[0, 1]];
  for (let k = 0; k < K.length - 1; k++) {
    if (days < K[k + 1]!) {
      const t = (days - K[k]!) / (K[k + 1]! - K[k]!);
      return [
        [k, 1 - t],
        [k + 1, t],
      ];
    }
  }
  return [[K.length - 1, 1]];
}

/** Solves A·x = b for symmetric positive-definite A (Cholesky). */
export function solveSpd(A: number[][], b: number[]): number[] {
  const n = b.length;
  const L = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i]![j]!;
      for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!;
      if (i === j) L[i]![i] = Math.sqrt(Math.max(s, 1e-12));
      else L[i]![j] = s / L[j]![j]!;
    }
  }
  const y = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = b[i]!;
    for (let k = 0; k < i; k++) s -= L[i]![k]! * y[k]!;
    y[i] = s / L[i]![i]!;
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]!;
    for (let k = i + 1; k < n; k++) s -= L[k]![i]! * x[k]!;
    x[i] = s / L[i]![i]!;
  }
  return x;
}

export function fitContextModel(ratings: readonly Rating[], opts: ContextOptions): ContextModel | null {
  const cal = opts.calibration ?? FIXED_CALIBRATION;
  const conf = opts.confidence ?? DEFAULT_CONFIDENCE;
  const halfLife = opts.halfLifeDays ?? 60;
  const lambda = opts.lambda ?? 2;

  // columns: 0 = μ, then one per (group, level), then freshness knots
  const cols = new Map<string, number>();
  const counts = new Map<number, number>();
  const col = (key: string): number => {
    let i = cols.get(key);
    if (i === undefined) {
      i = cols.size + 1;
      cols.set(key, i);
    }
    return i;
  };
  const fresh = FRESHNESS_KNOTS.map((d) => `fresh:${d}`);
  let hasFreshness = false;

  const rows: Row[] = [];
  for (const r of ratings) {
    if (r.deletedAt || r.excluded) continue;
    const pref = preferenceOf(r, cal, conf);
    if (!pref) continue;
    const x = new Map<number, number>([[0, 1]]);
    const add = (group: ContextGroup, level: string | null | undefined): void => {
      if (!level) return;
      const i = col(`${group}:${level}`);
      x.set(i, 1);
      counts.set(i, (counts.get(i) ?? 0) + 1);
    };
    if (r.source === 'home') {
      add('product', r.productId);
      add('method', r.brew?.method);
      const d = r.derived?.daysSinceRoast;
      if (d !== null && d !== undefined && d >= 0) {
        hasFreshness = true;
        for (const [k, v] of freshnessBasis(d)) if (v > 0) x.set(col(fresh[k]!), v);
      }
    } else {
      // café: the bean only counts when known (README §5.4)
      add('product', r.productId);
      add('drink', r.cafe?.drink);
      add('venue', r.venueId);
    }
    add('meal', r.meal.type);
    add('timeOfDay', r.timeOfDay);
    rows.push({ p: pref.p, w: pref.c * recencyWeight(r.ratedAt, opts.nowMs, halfLife), x });
  }
  if (rows.length === 0) return null;

  // normal equations (XᵀWX + Λ) θ = XᵀWp
  const m = cols.size + 1;
  const A = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  const b = new Array<number>(m).fill(0);
  for (const { p, w, x } of rows) {
    const entries = [...x];
    for (const [i, xi] of entries) {
      b[i]! += w * xi * p;
      for (const [j, xj] of entries) A[i]![j]! += w * xi * xj;
    }
  }
  for (let i = 1; i < m; i++) A[i]![i]! += lambda;
  if (A[0]![0]! <= 0) return null;
  const theta = solveSpd(A, b);

  const effects: Effect[] = [];
  const beanScores: Record<string, number> = {};
  for (const [key, i] of cols) {
    if (key.startsWith('fresh:')) continue;
    const sep = key.indexOf(':');
    const group = key.slice(0, sep) as ContextGroup;
    const level = key.slice(sep + 1);
    effects.push({ group, level, effect: theta[i]!, n: counts.get(i) ?? 0 });
    if (group === 'product') beanScores[level] = theta[0]! + theta[i]!;
  }
  effects.sort((a, b) => a.group.localeCompare(b.group) || b.effect - a.effect);

  return {
    mu: theta[0]!,
    n: rows.length,
    effects,
    beanScores,
    freshness: hasFreshness
      ? FRESHNESS_KNOTS.map((day, k) => ({ day, effect: cols.has(fresh[k]!) ? theta[cols.get(fresh[k]!)!]! : 0 }))
      : null,
  };
}

/** Freshness effect at any age, interpolated between knots. */
export function freshnessAt(curve: { day: number; effect: number }[], days: number): number {
  return freshnessBasis(days).reduce((s, [k, v]) => s + v * (curve[k]?.effect ?? 0), 0);
}
