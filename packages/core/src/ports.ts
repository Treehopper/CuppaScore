/** Injected effects. Core never reads the clock or randomness itself (README §8.1). */

export interface Clock {
  /** Current instant in epoch milliseconds. */
  now(): number;
}

/** Uniform random number in [0, 1). */
export type Rng = () => number;

export interface IdGenerator {
  next(): string;
}

export function fixedClock(ms: number | string): Clock & { set(ms: number | string): void; advance(ms: number): void } {
  let t = typeof ms === 'string' ? Date.parse(ms) : ms;
  return {
    now: () => t,
    set: (v) => {
      t = typeof v === 'string' ? Date.parse(v) : v;
    },
    advance: (d) => {
      t += d;
    },
  };
}

/** Deterministic PRNG (mulberry32) for tests and seeded exploration. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
