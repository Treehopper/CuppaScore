import { recencyWeight } from './aggregate';
import { FIXED_CALIBRATION, starsToP, type Calibration } from './preference';
import type { Rating } from './rating';
import { median } from './stats';

/** Personal centring and swipe calibration start at this many star / detail ratings (README §5.1). */
export const MIN_CALIBRATION_RATINGS = 10;
/**
 * Lower bound for the personal star spread: a very consistent rater would otherwise see half a
 * star swing the score by the full ±1.
 */
export const MIN_STAR_SD = 0.5;

export interface CalibrationOptions {
  nowMs: number;
  halfLifeDays?: number;
}

/**
 * Calibration from your own history (README §5.1): stars are centred on your recency-weighted
 * mean and spread, so "above my usual" is positive for a 4-star habit and a strict 3-star rater
 * alike; a right swipe then means what a typical good cup means for you.
 */
export function computeCalibration(ratings: readonly Rating[], opts: CalibrationOptions): Calibration {
  const starred = ratings.filter((r) => !r.deletedAt && !r.excluded && r.level !== 'swipe' && r.overall !== undefined);
  if (starred.length < MIN_CALIBRATION_RATINGS) return FIXED_CALIBRATION;

  const halfLife = opts.halfLifeDays ?? 60;
  const ws = starred.map((r) => recencyWeight(r.ratedAt, opts.nowMs, halfLife));
  const xs = starred.map((r) => r.overall!);
  const W = ws.reduce((a, b) => a + b, 0);
  const mean = xs.reduce((a, x, i) => a + ws[i]! * x, 0) / W;
  const variance = xs.reduce((a, x, i) => a + ws[i]! * (x - mean) ** 2, 0) / W;
  const stars = { mean, sd: Math.max(Math.sqrt(variance), MIN_STAR_SD) };

  const ps = xs.map((x) => starsToP(x, stars));
  const plus = median(ps.filter((p) => p > 0));
  const minus = median(ps.filter((p) => p < 0).map((p) => -p));
  return {
    stars,
    swipe: { plus: plus ?? FIXED_CALIBRATION.swipe.plus, minus: minus ?? FIXED_CALIBRATION.swipe.minus },
  };
}
