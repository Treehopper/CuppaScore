import {
  aggregate,
  catalogProductFeatures,
  exploreDims,
  featureVector,
  isDecaf,
  methodMatch,
  pricePerKg,
  recommend,
  seededRng,
  tasteProfile,
  userProductFeatures,
  wishShift,
  type AggregateOptions,
  type BrewMethod,
  type CatalogProduct,
  type Explanation,
  type Product,
  type Rating,
  type RatedProduct,
} from '@cuplog/core';

/** Filters of the Discover screen (README D3). */
export interface RecoQuery {
  /** "good for espresso" / "good for filter" (omni counts for both) */
  roastFor?: 'espresso' | 'filter';
  maxPricePerKg?: number;
  roaster?: string;
  includeDecaf?: boolean;
  limit?: number;
}

export interface RecommendationView {
  item: CatalogProduct;
  score: number;
  similarity: number | null;
  explanation: Explanation;
  /** the favourite named by a `similarTo` explanation */
  similarProduct: { id: string; roaster: string; name: string } | null;
  wishlisted: boolean;
  pricePerKg: number | null;
}

export interface RecommendationsView {
  items: RecommendationView[];
  /** products with a score that shaped the profile; < 5 means "cold start" (README §7.4) */
  ratedProducts: number;
  coldStart: boolean;
}

const ESPRESSO: readonly BrewMethod[] = ['espressoMachine', 'flairNeo', 'moka', 'beanToCup'];
const FILTER: readonly BrewMethod[] = ['v60', 'chemex', 'kalita', 'frenchPress', 'filterMachine', 'coldBrew'];

/** Espresso and/or filter, from the methods behind ≥ 30 % of your home cups (AeroPress counts for neither). */
export function preferredRoastFor(ratings: readonly Rating[]): ('espresso' | 'filter')[] {
  const home = ratings.filter((r) => r.brew);
  if (!home.length) return [];
  const share = (ms: readonly BrewMethod[]) => home.filter((r) => ms.includes(r.brew!.method)).length / home.length;
  return [...(share(ESPRESSO) >= 0.3 ? (['espresso'] as const) : []), ...(share(FILTER) >= 0.3 ? (['filter'] as const) : [])];
}

/** 75th percentile of what you paid per kg (bags with price and weight), null without any. */
export function usualPricePerKg(bags: readonly { priceEur: number | null; weightG: number | null }[]): number | null {
  const xs = bags.flatMap((b) => (b.priceEur && b.weightG ? [(b.priceEur / b.weightG) * 1000] : [])).sort((a, b) => a - b);
  if (!xs.length) return null;
  return xs[Math.min(xs.length - 1, Math.floor(0.75 * (xs.length - 1) + 0.5))]!;
}

/** A small stable hash so the exploration picks change daily, not on every refresh. */
function daySeed(nowMs: number): number {
  const day = Math.floor(nowMs / 86_400_000);
  return (day * 2654435761) >>> 0;
}

export interface RecoInputs {
  products: readonly Product[];
  ratings: readonly Rating[];
  bags: readonly { priceEur: number | null; weightG: number | null }[];
  catalog: readonly CatalogProduct[];
  wishlist: readonly string[];
  dismissed: readonly string[];
  agg: AggregateOptions;
}

/** Your products as recommender inputs: vector + current combined preference. */
export function ratedProducts(i: Pick<RecoInputs, 'products' | 'ratings' | 'catalog' | 'agg'>): RatedProduct[] {
  const catalog = new Map(i.catalog.map((c) => [c.id, c]));
  return i.products
    .filter((p) => !p.deletedAt)
    .map((p) => {
      const rs = i.ratings.filter((r) => r.productId === p.id);
      const sum = rs.length ? aggregate(rs, i.agg) : null;
      const vector = featureVector(
        userProductFeatures(p, {
          catalog: p.catalogId ? catalog.get(p.catalogId) : undefined,
          flavourTags: rs.flatMap((r) => r.flavourTags ?? []),
          profile: sum?.profile ?? null,
          advancedCount: sum?.byLevel.advanced ?? 0,
        }),
      );
      return { productId: p.id, catalogId: p.catalogId, vector, p: sum?.currentScore ?? null, dims: exploreDims(vector) };
    });
}

export function buildRecommendations(i: RecoInputs, q: RecoQuery = {}): RecommendationsView {
  const mine = ratedProducts(i);
  const rated = mine.filter((m) => m.p !== null);
  // "recent" wishes: the last 90 days of detailed cups (README §7.2)
  const since = i.agg.nowMs - 90 * 86_400_000;
  const recent = i.ratings.filter((r) => r.wish && Date.parse(r.ratedAt) >= since);
  const wishes = recent.length ? aggregate(recent, { ...i.agg, includeOutliers: true }).wishes : {};
  const profile = tasteProfile(
    rated.map((m) => ({ vector: m.vector, p: m.p! })),
    wishShift(wishes),
  );

  const likedDecaf = i.products.some((p) => p.decaf);
  const candidates = i.catalog
    .filter((c) => (q.includeDecaf ?? likedDecaf) || !isDecaf(c))
    .filter((c) => !q.roastFor || methodMatch(c.roastFor, [q.roastFor]) === 1)
    .filter((c) => q.maxPricePerKg === undefined || (pricePerKg(c) ?? Infinity) <= q.maxPricePerKg)
    .filter((c) => !q.roaster || c.roaster === q.roaster)
    .map((c) => ({ product: c, vector: featureVector(catalogProductFeatures(c)) }));

  const recs = recommend({
    candidates,
    mine,
    profile,
    preferredRoastFor: q.roastFor ? [q.roastFor] : preferredRoastFor(i.ratings),
    usualPricePerKg: usualPricePerKg(i.bags),
    dismissed: new Set(i.dismissed),
    rng: seededRng(daySeed(i.agg.nowMs)),
    limit: q.limit ?? 20,
  });
  const byId = new Map(candidates.map((c) => [c.product.id, c.product]));
  const products = new Map(i.products.map((p) => [p.id, p]));
  const wish = new Set(i.wishlist);
  return {
    items: recs.map((r) => {
      const fav = r.explanation.kind === 'similarTo' ? products.get(r.explanation.productId) : undefined;
      const item = byId.get(r.catalogId)!;
      return {
        item,
        score: r.score,
        similarity: r.similarity,
        explanation: r.explanation,
        similarProduct: fav ? { id: fav.id, roaster: fav.roaster, name: fav.name } : null,
        wishlisted: wish.has(r.catalogId),
        pricePerKg: pricePerKg(item),
      };
    }),
    ratedProducts: rated.length,
    coldStart: rated.length < 5,
  };
}
