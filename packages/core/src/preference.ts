import type { RatingLevel } from './enums';
import type { Rating } from './rating';
import { DEFAULT_CONFIDENCE, type ConfidenceWeights } from './settings';
import { clamp } from './stats';

/**
 * Personal calibration for mapping stars and swipes to `p` (README §5.1).
 * `null` star calibration → fixed mapping (3 ★ → 0, 5 ★ → +1, 1 ★ → −1).
 */
export interface Calibration {
  stars: { mean: number; sd: number } | null;
  swipe: { plus: number; minus: number };
}

export const FIXED_CALIBRATION: Calibration = { stars: null, swipe: { plus: 0.5, minus: 0.5 } };

export interface Preference {
  /** "less of this" −1 … +1 "more of this" */
  p: number;
  /** confidence weight of the input level */
  c: number;
}

/** Star value → p, before the would-buy-again bonus. */
export function starsToP(stars: number, cal: Calibration['stars']): number {
  if (!cal) return clamp((stars - 3) / 2, -1, 1);
  if (cal.sd <= 0) return clamp((stars - cal.mean) / 2, -1, 1);
  const z = clamp((stars - cal.mean) / cal.sd, -2, 2);
  return z / 2;
}

export const WOULD_BUY_AGAIN_BONUS = 0.1;

export function preferenceOf(
  r: Pick<Rating, 'level' | 'swipe' | 'overall' | 'wouldBuyAgain'>,
  cal: Calibration = FIXED_CALIBRATION,
  weights: ConfidenceWeights = DEFAULT_CONFIDENCE,
): Preference | null {
  const c = weights[r.level as RatingLevel];
  let p: number;
  if (r.level === 'swipe') {
    if (!r.swipe) return null;
    p = r.swipe === 'more' ? cal.swipe.plus : -cal.swipe.minus;
  } else {
    if (r.overall === undefined) return null;
    p = starsToP(r.overall, cal.stars);
  }
  if (r.wouldBuyAgain !== undefined) p += r.wouldBuyAgain ? WOULD_BUY_AGAIN_BONUS : -WOULD_BUY_AGAIN_BONUS;
  return { p: clamp(p, -1, 1), c };
}
