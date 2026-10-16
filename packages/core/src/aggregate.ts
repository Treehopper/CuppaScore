import type { OutlierMethod, ProfileAttr, Wish } from './enums';
import { PROFILE_ATTRS } from './enums';
import { detectOutliers, type ExclusionReason } from './outliers';
import { FIXED_CALIBRATION, preferenceOf, type Calibration } from './preference';
import type { Rating } from './rating';
import { DEFAULT_CONFIDENCE, type ConfidenceWeights } from './settings';
import { mean, median, stdDev, trimmedMean, weightedMean } from './stats';

const DAY_MS = 86_400_000;

/** w = 0.5 ^ (ageDays / halfLife) (README §5.3). Future timestamps count as age 0. */
export function recencyWeight(ratedAt: string, nowMs: number, halfLifeDays: number): number {
  const ageDays = Math.max(0, (nowMs - Date.parse(ratedAt)) / DAY_MS);
  return 0.5 ** (ageDays / halfLifeDays);
}

export interface AggregateOptions {
  nowMs: number;
  halfLifeDays?: number;
  outlierMethod?: OutlierMethod;
  /** C2 toggle: include auto-detected outliers in the numbers (manual exclusions always stay out). */
  includeOutliers?: boolean;
  calibration?: Calibration;
  confidence?: ConfidenceWeights;
}

export interface StarStats {
  n: number;
  mean: number;
  median: number;
  trimmedMean: number;
  sd: number;
}

export interface StatsSummary {
  /** all non-deleted ratings considered, including excluded ones */
  n: number;
  byLevel: { swipe: number; stars: number; advanced: number };
  /** ratings that count towards the scores */
  nCounted: number;
  /** all-time combined preference Σc·p/Σc, −1 … +1 */
  score: number | null;
  /** recency-weighted combined preference Σc·w·p/Σc·w (README §5.1/§5.3) */
  currentScore: number | null;
  /** trimmed mean of p, shown when there's too little data for MAD (README §5.2 step 4) */
  trimmedScore: number | null;
  /** spread (sd) of p */
  spread: number | null;
  stars: StarStats | null;
  /** mean 1–5 per profile attribute, advanced ratings only */
  profile: Partial<Record<ProfileAttr, number>> | null;
  /** counts of wish answers per attribute */
  wishes: Partial<Record<ProfileAttr, Record<Wish, number>>>;
  excluded: { ratingId: string; reason: ExclusionReason }[];
  robustMethod: 'mad' | 'trimmed' | 'off';
  /** chronological p series of counted ratings (sparkline / trend) */
  series: { ratingId: string; ratedAt: string; p: number; level: Rating['level'] }[];
}

export function aggregate(ratings: readonly Rating[], opts: AggregateOptions): StatsSummary {
  const halfLife = opts.halfLifeDays ?? 60;
  const cal = opts.calibration ?? FIXED_CALIBRATION;
  const weights = opts.confidence ?? DEFAULT_CONFIDENCE;
  const live = ratings.filter((r) => !r.deletedAt);

  const byLevel = { swipe: 0, stars: 0, advanced: 0 };
  for (const r of live) byLevel[r.level]++;

  const prefs = new Map<string, { p: number; c: number }>();
  for (const r of live) {
    const pref = preferenceOf(r, cal, weights);
    if (pref) prefs.set(r.id, pref);
  }
  const withP = live.filter((r) => prefs.has(r.id));
  const outl = detectOutliers(
    withP.map((r) => ({ id: r.id, x: prefs.get(r.id)!.p, excluded: r.excluded })),
    opts.outlierMethod ?? 'mad',
  );
  const counted = new Set(outl.keptIds);
  if (opts.includeOutliers) for (const e of outl.excluded) if (e.reason.kind === 'auto') counted.add(e.id);

  const rs = withP.filter((r) => counted.has(r.id)).sort((a, b) => Date.parse(a.ratedAt) - Date.parse(b.ratedAt));
  const ps = rs.map((r) => prefs.get(r.id)!.p);
  const cs = rs.map((r) => prefs.get(r.id)!.c);
  const cws = rs.map((r, i) => cs[i]! * recencyWeight(r.ratedAt, opts.nowMs, halfLife));

  const starVals = rs.filter((r) => r.level !== 'swipe' && r.overall !== undefined).map((r) => r.overall!);
  const stars: StarStats | null = starVals.length
    ? {
        n: starVals.length,
        mean: mean(starVals)!,
        median: median(starVals)!,
        trimmedMean: trimmedMean(starVals)!,
        sd: stdDev(starVals)!,
      }
    : null;

  const advanced = rs.filter((r) => r.level === 'advanced');
  let profile: StatsSummary['profile'] = null;
  const wishes: StatsSummary['wishes'] = {};
  for (const attr of PROFILE_ATTRS) {
    const vals = advanced.map((r) => r.profile?.[attr]).filter((v): v is number => v !== undefined);
    if (vals.length) (profile ??= {})[attr] = mean(vals)!;
    for (const r of advanced) {
      const w = r.wish?.[attr];
      if (w) {
        const slot = (wishes[attr] ??= { more: 0, justRight: 0, less: 0 });
        slot[w]++;
      }
    }
  }

  return {
    n: live.length,
    byLevel,
    nCounted: rs.length,
    score: weightedMean(ps, cs),
    currentScore: weightedMean(ps, cws),
    trimmedScore: trimmedMean(ps),
    spread: stdDev(ps),
    stars,
    profile,
    wishes,
    excluded: outl.excluded
      .filter((e) => !(opts.includeOutliers && e.reason.kind === 'auto'))
      .map((e) => ({ ratingId: e.id, reason: e.reason })),
    robustMethod: outl.method,
    series: rs.map((r, i) => ({ ratingId: r.id, ratedAt: r.ratedAt, p: ps[i]!, level: r.level })),
  };
}

/** −1 … +1 → −100 … +100 for display (README §5.5). */
export const toDisplayScore = (p: number): number => Math.round(p * 100);
