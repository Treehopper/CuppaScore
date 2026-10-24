import type { CatalogProduct } from './catalogCsv';
import type { Rng } from './ports';
import { cosine, FEATURE_DIMS, sharedDims, type FeatureVector } from './vector';

/**
 * Scoring catalog coffees (README §7.3) with explanations and an exploration slot (§7.4).
 * Pure: vectors, preferences and randomness are passed in.
 */

export interface RecoCandidate {
  product: CatalogProduct;
  vector: FeatureVector;
}

export interface RatedProduct {
  /** your product id */
  productId: string;
  catalogId: string | null;
  vector: FeatureVector;
  /** combined, centred preference −1 … +1 (null = not rated yet) */
  p: number | null;
  /** what makes it this product's region/process for exploration bookkeeping */
  dims: string[];
}

export type Explanation =
  /** like one of your favourites: shared feature dims, e.g. ["process.natural", "flavour.fruity"] */
  | { kind: 'similarTo'; productId: string; shared: string[] }
  /** matches your taste profile in these dims */
  | { kind: 'profile'; shared: string[] }
  /** something new for you: an origin region or process you haven't tried */
  | { kind: 'explore'; dim: string }
  /** not enough ratings yet: suits the methods you use */
  | { kind: 'coldStart'; shared: string[] };

export interface Recommendation {
  catalogId: string;
  score: number;
  /** similarity to your taste profile (−1 … 1), null without one */
  similarity: number | null;
  explanation: Explanation;
}

export interface RecoOptions {
  candidates: readonly RecoCandidate[];
  /** your products (rated or not); owned catalog ids are excluded */
  mine: readonly RatedProduct[];
  profile: FeatureVector | null;
  /** roast targets of the methods you use most (espresso machine → espresso, V60 → filter) */
  preferredRoastFor?: readonly ('espresso' | 'filter')[];
  /** €/kg you usually pay (e.g. 75th percentile of your bags); null = no price penalty */
  usualPricePerKg?: number | null;
  dismissed?: ReadonlySet<string>;
  rng: Rng;
  limit?: number;
  /** every n-th slot is an exploration pick (default 5, README D7) */
  exploreEvery?: number;
}

export const LIKED_P = 0.2;
export const DISLIKED_P = -0.2;
/** preference of a favourite you haven't rated yet: a clear like, below a run of 5-star cups */
export const FAVOURITE_P = 0.6;

export function pricePerKg(p: Pick<CatalogProduct, 'priceEur' | 'weightG'>): number | null {
  return p.priceEur !== null && p.weightG ? (p.priceEur / p.weightG) * 1000 : null;
}

/** 0 up to 25 % above what you usually pay, then growing to −0.2 at double the price. */
export function pricePenalty(eurPerKg: number | null, usual: number | null | undefined): number {
  if (eurPerKg === null || !usual) return 0;
  const over = eurPerKg / usual - 1.25;
  return over > 0 ? Math.min(0.2, (0.2 * over) / 0.75) : 0;
}

export function methodMatch(roastFor: readonly string[], preferred: readonly string[] | undefined): number {
  if (!preferred?.length || !roastFor.length) return 0;
  return roastFor.includes('omni') || roastFor.some((r) => preferred.includes(r)) ? 1 : 0;
}

/** Origin-region and process dims of a vector (the "region or process" of §7.4). */
export function exploreDims(v: FeatureVector): string[] {
  return FEATURE_DIMS.filter((d, i) => (d.startsWith('origin.') || d.startsWith('process.')) && v[i]! > 1e-9);
}

export function recommend(o: RecoOptions): Recommendation[] {
  const limit = o.limit ?? 20;
  const every = o.exploreEvery ?? 5;
  const owned = new Set(o.mine.flatMap((m) => (m.catalogId ? [m.catalogId] : [])));
  const rated = o.mine.filter((m) => m.p !== null);
  const liked = rated
    .filter((m) => m.p! >= LIKED_P)
    .sort((a, b) => b.p! - a.p!)
    .slice(0, 3);
  const disliked = rated.filter((m) => m.p! <= DISLIKED_P);
  const tried = new Set(o.mine.flatMap((m) => m.dims));

  const pool = o.candidates.filter((c) => c.product.available && !owned.has(c.product.id) && !o.dismissed?.has(c.product.id));

  const scored = pool.map((c) => {
    const similarity = o.profile ? cosine(o.profile, c.vector) : null;
    let bestLike: { m: RatedProduct; sim: number } | null = null;
    for (const m of liked) {
      const sim = cosine(m.vector, c.vector);
      if (!bestLike || sim > bestLike.sim) bestLike = { m, sim };
    }
    const worst = disliked.reduce((mx, m) => Math.max(mx, cosine(m.vector, c.vector)), 0);
    const mm = methodMatch(c.product.roastFor, o.preferredRoastFor);
    const score =
      (similarity ?? 0) + 0.15 * Math.max(0, bestLike?.sim ?? 0) - 0.2 * worst + 0.05 * mm - pricePenalty(pricePerKg(c.product), o.usualPricePerKg);
    const explanation: Explanation = !o.profile
      ? { kind: 'coldStart', shared: mm ? c.product.roastFor.map((r) => `roastFor.${r}`) : [] }
      : bestLike && bestLike.sim >= 0.5
        ? { kind: 'similarTo', productId: bestLike.m.productId, shared: sharedDims(bestLike.m.vector, c.vector) }
        : { kind: 'profile', shared: sharedDims(o.profile, c.vector) };
    return { c, score: round(score), similarity: similarity === null ? null : round(similarity), explanation };
  });

  scored.sort((a, b) => b.score - a.score || a.c.product.roaster.localeCompare(b.c.product.roaster) || a.c.product.name.localeCompare(b.c.product.name));

  const out: Recommendation[] = [];
  const used = new Set<string>();
  const take = (s: (typeof scored)[number], explanation: Explanation = s.explanation) => {
    used.add(s.c.product.id);
    out.push({ catalogId: s.c.product.id, score: s.score, similarity: s.similarity, explanation });
  };
  let i = 0;
  while (out.length < limit) {
    if (o.profile && every > 0 && (out.length + 1) % every === 0) {
      // exploration (D7): moderate similarity in a region/process you haven't tried
      const options = scored.filter(
        (s) => !used.has(s.c.product.id) && s.similarity !== null && s.similarity >= 0.4 && s.similarity <= 0.6 && exploreDims(s.c.vector).some((d) => !tried.has(d)),
      );
      if (options.length) {
        const pick = options[Math.floor(o.rng() * options.length)]!;
        take(pick, { kind: 'explore', dim: exploreDims(pick.c.vector).find((d) => !tried.has(d))! });
        continue;
      }
    }
    while (i < scored.length && used.has(scored[i]!.c.product.id)) i++;
    if (i >= scored.length) break;
    take(scored[i]!);
  }
  return out;
}

const round = (x: number) => Math.round(x * 1e4) / 1e4;
