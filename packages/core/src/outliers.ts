import { mad, median } from './stats';

export const ROBUST_Z_LIMIT = 3.5;
export const MIN_N_FOR_AUTO_EXCLUSION = 5;

export interface OutlierInput {
  id: string;
  x: number;
  /** manually flagged "not representative" (B9) */
  excluded?: boolean;
}

export type ExclusionReason = { kind: 'manual' } | { kind: 'auto'; z: number };

export interface OutlierResult {
  keptIds: string[];
  excluded: { id: string; reason: ExclusionReason }[];
  /** "mad" if automatic exclusion ran, "trimmed" when there was too little data / no spread. */
  method: 'mad' | 'trimmed' | 'off';
}

/**
 * Iglewicz–Hoaglin robust z-scores on p (README §5.2):
 * drop manual exclusions, then exclude |0.6745·(x − m)/MAD| > 3.5.
 * If n < 5 or MAD = 0 automatic exclusion is skipped and the trimmed mean is shown instead.
 */
export function detectOutliers(items: readonly OutlierInput[], method: 'mad' | 'trimmed' | 'off' = 'mad'): OutlierResult {
  const excluded: OutlierResult['excluded'] = [];
  const candidates: OutlierInput[] = [];
  for (const it of items) {
    if (it.excluded) excluded.push({ id: it.id, reason: { kind: 'manual' } });
    else candidates.push(it);
  }
  if (method !== 'mad') return { keptIds: candidates.map((c) => c.id), excluded, method };

  const xs = candidates.map((c) => c.x);
  const m = median(xs);
  const d = mad(xs);
  if (candidates.length < MIN_N_FOR_AUTO_EXCLUSION || m === null || !d) {
    return { keptIds: candidates.map((c) => c.id), excluded, method: 'trimmed' };
  }
  const keptIds: string[] = [];
  for (const c of candidates) {
    const z = (0.6745 * (c.x - m)) / d;
    if (Math.abs(z) > ROBUST_Z_LIMIT) excluded.push({ id: c.id, reason: { kind: 'auto', z: Math.round(z * 10) / 10 } });
    else keptIds.push(c.id);
  }
  return { keptIds, excluded, method: 'mad' };
}
