/** Numeric primitives. All functions are pure and return null for empty input. */

export function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs: readonly number[]): number | null {
  return xs.length ? sum(xs) / xs.length : null;
}

export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Sample standard deviation (n − 1); 0 for a single value. */
export function stdDev(xs: readonly number[]): number | null {
  const m = mean(xs);
  if (m === null) return null;
  if (xs.length < 2) return 0;
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

/** Mean after dropping `fraction` of values at each end (README §5.2: 10 %). */
export function trimmedMean(xs: readonly number[], fraction = 0.1): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length * fraction);
  return mean(s.slice(k, s.length - k));
}

/** Median absolute deviation (unscaled). */
export function mad(xs: readonly number[]): number | null {
  const m = median(xs);
  if (m === null) return null;
  return median(xs.map((x) => Math.abs(x - m)));
}

/** Σ wᵢxᵢ / Σ wᵢ; null when the total weight is 0. */
export function weightedMean(xs: readonly number[], ws: readonly number[]): number | null {
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += ws[i]! * xs[i]!;
    den += ws[i]!;
  }
  return den > 0 ? num / den : null;
}

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
